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

## Bằng chứng — 27 test tích hợp

```
$ npm run test:integration
     [itest] PostgreSQL 17.10 · stockflow_wms
         Tests  27 passed (27)
      Duration  255ms (transform 22ms, setup 0ms, collect 27ms, tests 66ms, environment 0ms, prepare 35ms)
```

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
