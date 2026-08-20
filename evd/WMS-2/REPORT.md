# WMS-2 — Nền danh tính (sau vòng review 3 người)

Ticket WMS-2 · [ADR-0003](../../docs/adr/0003-mo-hinh-du-lieu-danh-tinh.md) (Proposed)
· hồ sơ review: [dev/review.md](dev/review.md)

## Nói trước điều bất lợi: **AC3 CHƯA ĐẠT TRỌN**

AC viết: *"các vai trò mặc định **theo ma trận SRS §8** đã tồn tại"*. Bản đầu của
báo cáo này trích thiếu bảy chữ *"theo ma trận SRS §8"* rồi kết luận là đạt.
Reviewer R1 bắt được. Sự thật:

- 10 vai trò mặc định **tồn tại** ✅
- **Chỉ QTHT có quyền** (120/120), theo quyết định A7 của chủ dự án
- **9 vai trò còn lại chưa có quyền nào** ⇒ AC3 chưa đạt trọn

Lý do là một đánh đổi đã được cân: ma trận §8 (171 ô F/C/A/R) là nội dung spec mà
Q3+Q4 giữ ngoài repo public. Nhưng nếu KHÔNG vai trò nào có quyền thì với
NFR-SEC-04, **QTHT cũng không vào được SC-20** — đúng màn hình dùng để cấu hình
ma trận. Hệ thống tự khoá mình. Seed QTHT là mức tối thiểu phá được deadlock đó.
Phần còn lại: SC-20 hoặc seed cục bộ. Đã ghi thành việc treo ở
[decisions.md A7](../../docs/pm/decisions.md).

## Việc đã làm

6 thực thể + 3 bảng nối + migration đầu tiên của dự án. Đường đi hợp lệ là **ADR
trước, lược đồ sau** — luật do chính `prisma/schema.prisma` đặt ra, vì SRS §5.2
chỉ đặc tả cột cho 3 thực thể và không thực thể nào của WMS-2 nằm trong đó.

## Trạng thái CSDL sau migration (đo trực tiếp, trên container)

```
server: PostgreSQL 17.10 (container, musl)   bảng: 12
cột timestamp KHÔNG timezone: 0              khoá ngoại: 12
trigger: 4, tất cả ENABLE ALWAYS             vai trò: 10 · quyền: 120 · gắn: 120
so_du_ton_kho_to_hop_khoa NULLS NOT DISTINCT: true
nhat_ky_thao_tac.nguoi_dung_id: NULLABLE
```

## Bằng chứng — 51 test tích hợp

```
$ npm run test:integration
     [itest] PostgreSQL 17.10 · stockflow_wms
         Tests  51 passed (51)
      Duration  295ms (transform 29ms, setup 0ms, collect 36ms, tests 101ms, environment 0ms, prepare 34ms)
```

## Lần thử 2 — năm việc R3 đòi, và một lỗi tôi tự tìm ra

| R3 đòi | Đã làm |
|---|---|
| Ràng buộc CSDL cho định dạng băm | `CHECK` cho phép **đúng ba** họ thuật toán NFR-SEC-03 nêu tên (bcrypt · scrypt · Argon2). R3 gợi ý chỉ `^\$argon2` — chặn hẹp hơn spec là tự thu hẹp spec |
| Test `session_replication_role='replica'` | có, cho cả hai bảng chỉ-ghi-thêm |
| Khẳng định trọn 10 cặp (mã, tên) + tập `man_hinh` | có, khẳng định TẬP thay vì đếm lực lượng |
| Cam kết hồ sơ review | `evd/WMS-2/dev/review.md` đã commit |
| Ba test rẻ: kiểu cột · khoá ngoại · unique | có |

**Rồi tôi tự chạy lại bảy phép đột biến của R3 trước khi gửi review — và bắt được
một lỗi không ai nêu:** hai test khoá ngoại mới viết **xanh vì lý do sai**. Chúng
khẳng định `23503` nhưng không phân biệt khoá ngoại nào phát ra nó, nên gỡ
`chuyen_dong_kho_kho_id_fkey` thì khoá ngoại `nguoi_thuc_hien_id` che mất và test
vẫn xanh. Sửa theo lớp: **khẳng định TÊN ràng buộc** ở 12 chỗ, không chỉ mã lỗi.
Một lỗi thứ hai lộ ra cùng lúc: câu DELETE dùng CTE ghi dữ liệu **không thấy dòng
CTE vừa chèn** (cùng ảnh chụp), nên nó xoá 0 dòng và test xanh vô nghĩa.

### Bảng đột biến — số thật, không tổng kết tuyệt đối

Bản trước của mục này viết *"Không phép nào còn lọt"* và liệt kê **2 trong 3**
khoá ngoại của phép đột biến gốc — cái bị bỏ ra (`so_du_ton_kho_kho_id_fkey`)
chính là cái còn lọt. R3 bắt được (CHẶN-1b). **Lần thứ năm tôi khẳng định một
điều về công việc của mình mà không kiểm lại.** Số dưới đây là đo thật, từng phép
trên một bản nhân bản riêng:

| Phép đột biến | Kết quả |
|---|---|
| gỡ `so_du_ton_kho_kho_id_fkey` *(từng lọt)* | 1 đỏ |
| gỡ `phien_nguoi_dung_id_fkey` *(từng lọt)* | 1 đỏ |
| gỡ unique `kho_ma_key` *(từng lọt)* | 1 đỏ |
| gỡ unique `quyen_man_hinh_hanh_dong_key` *(từng lọt)* | 1 đỏ |
| `DROP TABLE phien CASCADE` *(từng lọt)* | 2 đỏ |
| `phien.het_han_luc` → `text` *(từng lọt)* | 1 đỏ |
| nới CHECK băm thành `~ '^\$'` *(từng lọt)* | 3 đỏ |
| hạ `ENABLE ALWAYS` **chỉ** trên 2 trigger TRUNCATE *(từng lọt)* | 3 đỏ |
| `mat_khau_hash` VARCHAR(255) → VARCHAR(60) *(từng lọt)* | 8 đỏ |
| `mat_khau_hash DROP NOT NULL` | 1 đỏ |
| đổi `ON DELETE RESTRICT` → `SET NULL` | 1 đỏ |

**Cái làm chúng chết không phải mười một bản vá.** Nó là **một** ảnh chụp lược đồ
(`src/lib/__tests__/luoc-do.snapshot.json`, sinh bằng `scripts/chup-luoc-do.mjs`)
khẳng định **TẬP** cột/khoá ngoại/chỉ mục/CHECK/trigger thay vì danh sách cấm.
R3 nói đúng: danh sách cấm không bắt được thứ chưa ai gọi tên. Ba phép cuối trong
bảng chưa ai từng nêu — chúng chết vì tính chất, không vì bị đoán trúng.

Hai phép cần cả bản vá thứ hai: `VARCHAR(60)` chỉ chết sau khi ảnh chụp ghi thêm
**độ dài cột** (`udt_name` của `varchar(255)` và `varchar(60)` giống hệt nhau) và
fixture đổi sang băm argon2id **dài thật 98 ký tự** thay vì chuỗi giả 45 ký tự.

## Vòng review 3 người tìm ra 12 finding chặn — tóm tắt cái nặng nhất

**R3 chạy 8 phép đột biến; 6 phép để bộ test cũ xanh nguyên.** Xoá hai bảng nối
thay bằng bảng rác: xanh. Ép quan hệ về 1–n: xanh. Nhét mật khẩu **rõ** vào
`mat_khau_hash`: xanh. Thu CHECK từ 6 cột còn 1: xanh. Nguyên nhân chung: bộ test
cũ kiểm **siêu dữ liệu** (đếm cột, đếm dòng) rồi dán nhãn **hành vi** lên kết quả.
Bản mới kiểm hành vi — làm thật rồi xem CSDL có chặn không.

**R2 phá được cơ chế chỉ-ghi-thêm bằng 6 đường**, trong đó `TRUNCATE` lọt hoàn
toàn (trigger `FOR EACH ROW` không bắt TRUNCATE) và `session_replication_role`
tắt được trigger. Migration cũ còn tuyên bố *"trigger chặn mọi vai trò, kể cả
superuser"* — sai. Nay: thêm trigger `BEFORE TRUNCATE`, `ENABLE ALWAYS`, và câu
mô tả nói đúng cả những gì nó **không** chặn được (chủ sở hữu bảng vẫn
`DROP TRIGGER` được — chỗ đó phải giải bằng quyền, phụ thuộc OPN-03).

**R2 chứng minh migration không nguyên tử**: Prisma bắn từng câu autocommit, nên
một lỗi giữa chừng để lại 12 bảng đã commit và đường phục hồi chính thức tắc.
Nay bọc `BEGIN/COMMIT`, kèm ghi chú đừng biến thành luật mù (`CREATE INDEX
CONCURRENTLY` và phân vùng của OPN-03 không chạy trong transaction).

**R2 tìm ra `so_du_ton_kho` cho phép hai dòng số dư trùng nhau** khi `lo_id`
NULL (Postgres mặc định NULLS DISTINCT) — vỡ BRULE-11 và vỡ đối soát DI-03, lỗi
**có từ trước WMS-2**. Nay là index `NULLS NOT DISTINCT` viết tay.

**R1 tìm ra FR-01-08 không thi hành được**: `nguoi_dung_id` NOT NULL nghĩa là lần
đăng nhập sai với **tên không tồn tại** — trường hợp phổ biến nhất — không ghi
được dòng nào, và bảng chỉ-ghi-thêm nên không vá sau. Nay nullable.

**R1 tìm ra 14 cột thời gian sai kiểu** so với DC-06 (UTC+7): `timestamp without
time zone` lưu theo `TimeZone` của phiên client, R1 đo lệch **đúng 7 giờ**. Nay
0 cột.

**R1 tìm ra ba khoá ngoại mà SRS §5.2 gọi thẳng tên vẫn chưa được tạo**, ngay
trong commit sửa cái luật bắt phải tạo chúng. Nay có, `onDelete: Restrict`.

## Điều tôi làm sai và đã sửa, ghi riêng để không tự bào chữa

1. **Trích AC thiếu bảy chữ rồi kết luận là đạt** (R1-F1).
2. **Hai khẳng định "đã ghi tài liệu" đều sai** (R1-F3): `docs/specs/changes.md`
   không tồn tại lúc tôi viết câu đó, và việc treo về ma trận quyền chưa từng
   được ghi vào `decisions.md`. Nay cả hai đã có thật.
3. **ADR nói `Kho` "chỉ được có 4 cột" trong khi lược đồ có 6** — một ADR đặt luật
   "mỗi cột phải truy được" thì không được sai ở phép đếm cột của chính nó.
4. **`Kho.dangHoatDong` dẫn nguồn sai** (FR-20-01 nói về tài khoản, DI-07 nói về
   chứng từ). Nguồn đúng là ràng buộc kích hoạt kho của SC-06.
5. **Bỏ nửa "ai" của luật cột kiểm toán mà không nói lý do.** Nay có lý do viết ra.
6. **FR-01-03 vắng mặt không một dòng giải thích**, trong khi TOTP và lịch sử mật
   khẩu đều được hoãn có lý do. Nay đã ghi.
7. **Ghi "chưa quy được nguyên nhân" cho việc shadow DB biến mất** — có nguyên
   nhân, và nó nằm ngay trong `lsof`. Xem mục dưới.

## Nguyên nhân thật của "shadow DB biến mất": KI-003

Có **hai PostgreSQL cùng đòi cổng 5432**. Container bind `*:5432`, Homebrew bind
`127.0.0.1:5432` và `[::1]:5432`; **bind cụ thể thắng bind wildcard**, nên mọi
kết nối `@localhost:5432` rơi vào Homebrew. Container trống trơn, shadow DB vẫn
sống nguyên trong đó — chỉ là không ai với tới. **Toàn bộ migration và test của
vòng đầu chạy nhầm server**, không phải server mà SRS §2.3 yêu cầu. Reviewer R2
tìm ra bằng `lsof`. Đã dừng Homebrew, chạy lại tất cả trên container, và
`db-check.sh` nay in tên server + database + max_connections thay vì chỉ
"reachable". Ghi thành [KI-003](../../docs/qa/known-issues.md) và cảnh báo trong README.

## Một lỗ bảo mật do CHÍNH bản sửa này tạo ra — chưa vá, và nói rõ vì sao

Reviewer R2 chỉ ra: ràng buộc chống lưu mật khẩu rõ **lại in mật khẩu rõ ra log**.
Vi phạm CHECK trả `DETAIL: Failing row contains (8, z, z@x, Z, SieuBiMat!2026, …)`,
kể cả với truy vấn tham số hoá; dòng đó vào log server, và `e.detail` của driver
`pg` vào log ứng dụng. **NFR-SEC-09 cấm ghi mật khẩu vào tệp nhật ký.**

**Chưa vá, và đây là lý do** — không phải vì rẻ hơn: lỗ này **không** chỉ ở CHECK
của tôi. Mọi vi phạm ràng buộc trên `nguoi_dung` đều in cả dòng, gồm cột băm; một
INSERT trùng tên đăng nhập cũng in. Đổi riêng CHECK này thành trigger sẽ bịt đúng
một đường trong nhiều đường và **tạo cảm giác đã xong**. Chỗ sửa thật nằm ở tầng
ứng dụng (không log `e.detail` cho bảng này) và ở cấu hình triển khai
(`log_error_verbosity = terse`) — cả hai thuộc WMS-3 và phụ thuộc OPN-03. Đã ghi
thành ràng buộc thiết kế cho WMS-3 trong `docs/pm/decisions.md`.

## Giới hạn còn lại

- **CI chưa chạy `test:integration`**: `vteam-gate.yml` không có service Postgres,
  và bước đó là `tail` nên `gate.sh` bỏ qua. Đường duy nhất chạm tới là
  `gate e2e`, mà đường đó vẫn đỏ vì `test:e2e` chưa tồn tại. R2 và R3 đều đề nghị
  thêm một job CI riêng — **chưa làm, ngoài phạm vi ticket**, đã ghi vào README.
- `so_du_ton_kho_khong_am` là ràng buộc **từng cột**, không phải bất biến:
  `(thuc_te=10, phan_bo=9999)` vẫn lọt. Công thức BRULE-11 phải được canh ở giao
  dịch ghi tồn (DC-05), thuộc ticket có luồng nhập/xuất.
- Trigger **không** chặn được chủ sở hữu bảng (`DROP TRIGGER`, `DROP TABLE`).
  Chỗ đó phải giải bằng quyền, phụ thuộc **OPN-03**.
- Phân vùng `chuyen_dong_kho` theo tháng: chờ **OPN-03**.
- Lịch sử mật khẩu (S-04), TOTP (chờ **G-02**), token khôi phục (S-05): chỗ trống
  có chủ ý, ghi trong ADR-0003.
