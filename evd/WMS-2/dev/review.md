# WMS-2 — hồ sơ review

Diff chạm `prisma/schema.prisma` và `prisma/migrations/` ⇒ **high-stakes**, cần
**3 reviewer** (`review.reviewers: 2` + 1). Model theo `docs/team/model-routing.md`:
cả ba là `opus` (dev-r2 được nâng tier vì high-stakes).

| Vòng | R1 (truy vết yêu cầu) | R2 (an toàn migration) | R3 (chất lượng test) |
|---|---|---|---|
| 1 · `ce37c16` | REQUEST-CHANGES · 6 chặn | REQUEST-CHANGES · 3 chặn | REQUEST-CHANGES · 3 chặn |
| 2 · `87fa63f` | **APPROVE** | **APPROVE** | REQUEST-CHANGES · 2 chặn |

**Kết quả: 2/3 chữ ký. WMS-2 KHÔNG merge.**

---

## VÒNG 1 — 12 finding chặn

### R1 · truy vết yêu cầu
- **F1** AC3 không đạt, **và tác giả trích AC thiếu bảy chữ "theo ma trận SRS §8"** rồi
  kết luận là đạt. Hệ quả R1 chỉ ra mà tác giả không thấy: với NFR-SEC-04, ma trận
  rỗng nghĩa là **QTHT cũng không vào được SC-20** — đúng màn hình duy nhất dùng để
  cấu hình ma trận. Hệ thống tự khoá mình lúc khởi tạo.
- **F2** `nhat_ky_thao_tac.nguoi_dung_id` NOT NULL + FK ⇒ **không ghi được lần đăng
  nhập sai với tên không tồn tại**, tức trường hợp phổ biến nhất của FR-01-08 và là
  trường hợp mà ràng buộc chống dò tài khoản buộc phải xử lý. Bảng chỉ-ghi-thêm nên
  không vá bằng dữ liệu sau. R1 thử cả `999999` lẫn `NULL`: cả hai đường đều đóng.
- **F3** Hai khẳng định "đã ghi tài liệu" trong diff **đều sai**: `docs/specs/changes.md`
  không tồn tại (`find` rỗng, git đã xoá ở `96124f4`), và việc treo về ma trận quyền
  chưa từng có trong `decisions.md`.
- **F4** ADR nói `Kho` "chỉ được có 4 cột", CSDL có **6**. Và luật cột kiểm toán của BA
  là "ai/khi nào" — lược đồ lấy nửa "khi nào", **bỏ im lặng nửa "ai"**.
- **F5** Ba khoá ngoại mà SRS §5.2 gọi thẳng tên (`so_du_ton_kho.kho_id`,
  `chuyen_dong_kho.kho_id`, `nguoi_thuc_hien_id`) vẫn là BigInt trần — ngay trong
  commit sửa cái luật bắt phải chuyển chúng thành `@relation`.
- **F6** 14 cột `timestamp without time zone` vs DC-06 (UTC+7). R1 đo: hai INSERT cùng
  transaction, chỉ khác `SET LOCAL TimeZone` → **lệch đúng 07:00:00**.
- F7 thiếu vai trò thứ 10 (Kiểm toán nội bộ, §2.2 + FR-20-03) · F8 FR-01-03 vắng mặt
  không một dòng giải thích · F9 `Kho.dangHoatDong` dẫn nguồn sai · F10 pool chưa đặt
  tường minh dù ADR-0003 nói đó là nghĩa vụ của WMS-2.

### R2 · an toàn migration
- **CHẶN-1** Migration **không chạy trong transaction**. Prisma bắn từng câu autocommit.
  R2 chèn lỗi ở cuối file rồi deploy lên CSDL trắng: **12 bảng + toàn bộ seed đã
  commit**, `_prisma_migrations.finished_at=NULL`. Đường phục hồi chính thức cũng tắc
  (`42P07 already exists`).
- **CHẶN-2** Trigger chặn được **ít hơn hẳn** điều migration tự tuyên bố. Câu *"chặn mọi
  vai trò, kể cả superuser"* sai. R2 phá bằng 6 đường: `TRUNCATE` lọt hoàn toàn
  (`FOR EACH ROW` không bắt TRUNCATE), `session_replication_role='replica'` lọt,
  `DISABLE TRIGGER` lọt, `CREATE OR REPLACE` hàm lọt, `DROP TABLE` lọt.
- **CHẶN-3** `so_du_ton_kho` **cho phép hai dòng số dư trùng nhau** khi `lo_id IS NULL`
  (Postgres mặc định NULLS DISTINCT). Vỡ BRULE-11 và vỡ đối soát DI-03. **Lỗi có từ
  trước WMS-2.**
- 🟠 `chuyen_dong_kho` không có khoá ngoại nào ⇒ xoá một `NguoiDung` là sổ kho mất
  thông tin "ai làm": bất biến nhưng không đọc được, vô dụng với ST-15.
- 🟡 seed không idempotent · thiếu `CHECK ton_sau >= 0` · quy ước dấu DI-02 không được
  ghi · `chan_sua_xoa` thiếu `search_path` · CI chưa bao giờ áp migration lên Postgres trắng.
- **Câu 7 — R2 giải được câu đố tác giả ghi là "chưa quy được nguyên nhân":**
  **hai PostgreSQL cùng đòi cổng 5432.** Container bind `*:5432`, Homebrew bind
  `127.0.0.1:5432` và `[::1]:5432`; **bind cụ thể thắng bind wildcard**, nên mọi kết nối
  `@localhost:5432` rơi vào Homebrew. Container trống trơn; `stockflow_wms_shadow` vẫn
  sống nguyên trong đó, chỉ là không ai với tới. **Toàn bộ migration và test vòng 1
  chạy nhầm server**, không phải server mà SRS §2.3 yêu cầu. → KI-003.

### R3 · chất lượng test — 8 phép đột biến, **6 phép để 13/13 xanh nguyên**
| Đột biến | Kết quả |
|---|---|
| Xoá 2 bảng nối, thay bằng bảng rác 2 cột | 13/13 xanh |
| `UNIQUE (nguoi_dung_id)` ép quan hệ về 1–n | 13/13 xanh |
| Nhét mật khẩu **rõ** vào `mat_khau_hash` + 4 cột bí mật mới | 13/13 xanh |
| Thu CHECK DI-01 từ 6 cột còn 1 (`-99` lọt vào 5 cột) | 13/13 xanh |
| 120 dòng quyền → 120 dòng rác, `ten` vai trò → 'rác' | 13/13 xanh |
| Trigger chặn luôn INSERT (nhật ký hỏng hoàn toàn) | 3 test "bị chặn" xanh giả |

Nguyên nhân chung: bộ test kiểm **siêu dữ liệu** (đếm cột, đếm dòng) rồi dán nhãn
**hành vi** lên kết quả. Cộng F6 (thiếu `table_schema='public'` → rác của WMS-1 gây
đỏ giả) và F7 (không có chốt an toàn tên CSDL cho DML không WHERE).

---

## VÒNG SỬA — `87fa63f`

Môi trường chạy lại toàn bộ trên container 17.10 sau khi dừng Homebrew. Lược đồ:
timestamptz, 3 khoá ngoại, `nguoi_dung_id` nullable. Migration dựng lại thành MỘT file:
`BEGIN/COMMIT`, trigger `BEFORE TRUNCATE` + `ENABLE ALWAYS`, index `NULLS NOT DISTINCT`,
`CHECK ton_sau >= 0`, seed idempotent, vai trò thứ 10, QTHT toàn quyền (quyết định A7).
Test viết lại 13 → 27, kiểm hành vi. Tài liệu: ADR sửa 5 chỗ, `changes.md` viết lại,
A7 vào hàng đợi, pool = 20 tường minh, KI-003, cảnh báo README.

---

## VÒNG 2 — re-review

### R1 · **APPROVE** — 10/10 finding đóng
Kiểm bằng truy vấn riêng, không đọc lại báo cáo. Đáng chú ý:
- **Tính nguyên tử:** chèn `SELECT 1/0` ngay trước `COMMIT`, deploy lên CSDL trắng →
  **còn đúng 1 bảng**. Rồi `migrate resolve --rolled-back` + deploy bản sạch → 12 bảng,
  seed đủ. **Đường phục hồi vòng trước tắc, nay thông.**
- **Pool:** không đọc code mà đo — 40 truy vấn `pg_sleep` đồng thời, `pg_stat_activity`
  đỉnh 21 (gồm 1 kết nối quan sát) ⇒ trần đúng 20.
- **Ranh giới mới tìm ra:** lỗi nằm **sau** `COMMIT;` thì 11 bảng vẫn commit hết. Hôm nay
  vô hại vì `COMMIT;` là dòng cuối; ai thêm SQL sau nó thì mất im lặng.
- 4 finding mới không chặn: hồ sơ review không tồn tại (chính file này), tên index lệch,
  chú thích lược đồ còn ghi "9 vai trò", và DC-06 không có test canh.

### R2 · **APPROVE** — mọi finding đóng
11/11 đường tấn công tầng ứng dụng nay bị chặn, gồm cả `TRUNCATE`,
`session_replication_role='replica'`, `MERGE … WHEN MATCHED THEN DELETE`, và CTE
`WITH x AS (UPDATE …)`. Ba đường còn lọt (`DISABLE TRIGGER ALL`, `CREATE OR REPLACE`
hàm, `DROP TABLE`) **đúng bằng ba đường migration đã tự khai là không chặn được** —
không còn tuyên bố sai sự thật.
- **N1 🟡** `ENABLE ALWAYS` không có test ghim. Nặng hơn: chu trình `DISABLE TRIGGER ALL`
  → `ENABLE TRIGGER ALL` (kịch bản nạp dữ liệu hàng loạt) **hạ `A` xuống `O` không báo
  lỗi**, sau đó nhật ký xoá sạch được mà bộ test vẫn 27/27.
- **N2 🟡** tên index lệch ⇒ `migrate dev` sau sẽ sinh migration thừa. R2 đã đo: RENAME
  **giữ nguyên** NULLS NOT DISTINCT, nên là phiền toái chứ không phải hồi quy.

### R3 · **REQUEST-CHANGES** — 7/8 đột biến cũ nay chết, nhưng 7 phép mới lọt
| Đột biến | Kết quả |
|---|---|
| Mật khẩu **rõ** trong `mat_khau_hash` | **27/27 xanh** — NFR-SEC-03 không có gì thi hành |
| Bỏ `ENABLE ALWAYS` rồi `session_replication_role='replica'; DELETE` | **27/27 xanh**, nhật ký xoá sạch |
| Đảo 14 cột `timestamptz` về `timestamp` | 27/27 xanh |
| Gỡ cả 3 khoá ngoại vừa thêm | 27/27 xanh |
| Gỡ `UNIQUE` `ten_dang_nhap` + `email` | 27/27 xanh — hai tài khoản trùng tên vào được |
| Đổi tên 8 vai trò ngoài QTHT/KTNB | 27/27 xanh (test chỉ soi 2/10) |
| `SC-xx` → `RAC-xx`, vẫn đủ 120 dòng | 27/27 xanh (chỉ đếm DISTINCT) |

**Năm việc để R3 đổi sang APPROVE:** (1) ràng buộc CSDL cho định dạng băm +
test đôi; (2) test `session_replication_role='replica'` cho cả hai bảng chỉ-ghi-thêm;
(3) khẳng định trọn 10 cặp `(ma, ten)` và tập `man_hinh` bằng `SC-01…SC-20`;
(4) cam kết hồ sơ review (file này); (5) ba test rẻ cho kiểu cột / khoá ngoại / unique.

**R3 tự phê, đáng ghi:** hai phép `E2`/`P` là họ **tự dời cột mốc** (phép gốc đã chết),
và lỗ ở chốt an toàn tên CSDL là do **finding của chính họ viết hẹp** nên đẻ ra bản vá
hẹp — *"finding viết hẹp thì đẻ ra bản vá hẹp; lỗi đó là của tôi."*

---

## Phản hồi của tác giả

Không tranh luận điểm nào; hết vòng phản biện theo luật /dev, không có vòng ba.

**Bốn lần cùng một lỗi.** F3 vòng 1 bắt hai khẳng định "đã ghi tài liệu" sai. Trong
chính commit sửa F3, tôi lại viết hai câu dẫn tới `evd/WMS-2/dev/review.md` — file
không tồn tại cho tới lúc này. Trước đó ở WMS-1 là `r = 0,920` viết cứng và một chuỗi
`EXPLAIN` chưa từng chạy. Bốn lần, cùng một hình dạng: **khẳng định một điều về công
việc của chính mình mà không kiểm lại.** Cả bốn đều chỉ bị bắt vì có người đọc độc lập.

**Điều R3 nói mà tôi thấy đúng nhất:** bản sửa của tôi "trông giống vá theo phép đột
biến hơn là vá theo lớp lỗi". Tôi sửa đúng những chỗ R3 nêu tên — QTHT và KTNB — nên
đổi tên 8 vai trò còn lại vẫn lọt. Đó là vá theo triệu chứng.

**Trạng thái:** `failed: vòng review 3 người (2/3 chữ ký)`. Năm việc R3 nêu đều rẻ và
cụ thể; WMS-2 còn một lần thử tự chọn trước khi chạm loop guard #3.


---

# LẦN THỬ 2 — hai vòng nữa

| Vòng | R2 (migration) | R3 (test) |
|---|---|---|
| 1 · `fcd0759` | **APPROVE** | REQUEST-CHANGES · CHẶN-1 + 1b |
| 2 · `d6246d5` | không gọi lại (diff không chạm migration) | REQUEST-CHANGES · **CHẶN-2** |

## R2 · APPROVE, kèm 6 ghi nhận
Regex băm đúng cú pháp và đúng phạm vi đã tuyên bố; `map:` đóng drift (diff rỗng,
gỡ `map:` thì hiện lại); replay từ CSDL trắng 38/38; tính nguyên tử còn nguyên
(lỗi trước `COMMIT` → 1 bảng · gỡ `BEGIN/COMMIT` → 4 bảng rò); seed idempotent.
- **M-1** mẫu âm không có ký tự `$` ⇒ nới CHECK xuống `~ '\$'` vẫn 38/38 xanh.
- **M-2** `ENABLE ALWAYS` mới canh DELETE; hạ ALWAYS riêng trên trigger TRUNCATE
  → 38/38 xanh rồi `replica; TRUNCATE` **xoá sạch nhật ký kiểm toán**.
- **M-3** ràng buộc chống mật khẩu rõ **lại in mật khẩu rõ** qua `DETAIL` ⇒ vi
  phạm NFR-SEC-09.
- M-4 `BEGIN/COMMIT` che lỗi gốc · M-5 REPORT ghi "3 đỏ", đo thật 2 đỏ ·
  M-6 `mat_khau_hash` NOT NULL + CHECK ⇒ không có giá trị hợp lệ cho "đã tạo tài
  khoản, chưa đặt mật khẩu" (ràng buộc thiết kế cho WMS-3).

## R3 vòng 1 · CHẶN-1 — vá theo tên đối tượng, không theo lớp
Đo được: 10/12 khoá ngoại · 3/6 chỉ mục duy nhất · `DROP TABLE phien` · mọi phép
đổi kiểu cột — tất cả gỡ được mà **38/38 xanh**. Gồm `so_du_ton_kho_kho_id_fkey`,
một trong ba khoá ngoại R1-F5 gọi thẳng tên. **CHẶN-1b:** REPORT viết "Không phép
nào còn lọt" trong khi liệt kê 2/3 khoá ngoại — cái bỏ ra chính là cái còn lọt.

## Vòng sửa 2 → `d6246d5`
Thay ba danh sách cấm bằng MỘT ảnh chụp lược đồ khẳng định tập cột (kèm độ dài,
nullable) · khoá ngoại (kèm `ON DELETE`) · chỉ mục duy nhất (kèm `NULLS NOT
DISTINCT`) · CHECK · trigger (kèm `ALWAYS`/`ORIGIN`). Cộng M-1, M-2, và fixture
đổi sang băm argon2id dài thật 98 ký tự.

## R3 vòng 2 · CHẶN-1 và CHẶN-1b ĐÓNG, nhưng **CHẶN-2**

**26/26** phép đột biến cũ nay đỏ, gồm cả 12 khoá ngoại và cả 6 chỉ mục gỡ riêng
từng cái. 11/11 dòng trong bảng đột biến của REPORT **khớp chính xác** số R3 đo.

**Nhưng ảnh chụp ghi ĐỊNH DANH, không ghi ĐỊNH NGHĨA.** R3 áp 9 phép đột biến
cùng lúc rồi chạy lại trình sinh trên chính CSDL đã hỏng: **không một byte khác
nhau**, 51/51 xanh. Chín phép lọt:

| Phép | Ảnh chụp không ghi | Khai thác đã chạy được |
|---|---|---|
| N9 thay thân `chan_sua_xoa()` thêm cửa hậu | thân hàm | `SET app.bo_qua='1'; DELETE` → xoá sạch sổ kiểm toán |
| N10 thêm `WHEN (OLD.dia_chi_ip <> …)` vào trigger | `tgqual` | xoá được dòng kiểm toán từ IP đó |
| N4 dựng lại CHECK **giữ tên**, nới biểu thức | biểu thức | `ton_truoc=10, so_luong=5, ton_sau=9999` — DI-02 vỡ |
| N6 gỡ khoá chính bảng nối | `indisprimary` bị loại trừ | 3 dòng `nguoi_dung_kho` trùng — BR-22 vỡ |
| N5 đổi `DEFAULT` | `column_default` | tài khoản mới sinh ra với `so_lan_sai=5` |
| N1 `ON UPDATE CASCADE` → `NO ACTION` ×12 | `confupdtype` | — |
| N3 unique thành partial, **giữ tên** | cột và `WHERE` của index | 2 người dùng trùng `ten_dang_nhap` |
| N2 dựng lại unique **cùng tên** trên cột khác | cột của index | 2 kho trùng mã |
| N8 `ENABLE ROW LEVEL SECURITY` | RLS | vai trò ứng dụng thấy 0 dòng |

Ba phép (N5, N6, N1) **không cần kẻ tấn công** — `@default`, `@@id`, `onUpdate:`
là thứ `schema.prisma` diễn đạt trực tiếp. Hai phép (N9, N10) phá đúng bất biến
BRULE-13 / DI-07 mà ticket này sinh ra để dựng.

**Bản vá R3 đòi:** một phép thay thế trong `chup-luoc-do.mjs` — dùng
`pg_get_constraintdef()`, `pg_get_indexdef()`, `pg_get_triggerdef()` +
`md5(prosrc)`, thêm `column_default`/`is_generated`, thêm mặt khoá chính. Giết
8/9. Kèm sửa hai câu tuyên bố sai lớp ("khẳng định TẬP, không phải danh sách cấm").

**R3 chấp nhận lập luận hoãn M-3/A8** sau khi tự kiểm rằng không viết được CHECK
nào khiến Postgres thôi in dòng lỗi: *"hoãn là quyết định đúng, ghi chép đủ,
không phải nợ giấu"*. Và **rút lại** gợi ý `^\$argon2` của chính họ: *"tôi đòi
tác giả tự thu hẹp spec. Tác giả đúng, tôi sai."*

**MY WEAK SPOT của R3, nguyên văn:** *"Hai vòng liền, block của tôi thấp hơn lớp
đúng một tầng. Nếu có vòng ba tôi ngờ mình sẽ tìm ra tầng thứ tư."* và *"Verdict
này sát ranh… mọi phép lọt đều do chính tay tôi viết vào. Một reviewer khác có
thể APPROVE, và tôi không gọi được lựa chọn đó là sai."*

## Phản hồi của tác giả

Không tranh luận. CHẶN-2 đúng và bản vá R3 mô tả là đúng hình dạng.

**Nhưng đây là chỗ luật dừng, không phải chỗ sửa tiếp.** Hết vòng phản biện của
lần thử 2; WMS-2 có dòng hỏng thứ hai ⇒ loop guard #3 cấm máy tự chọn lại. Và
chính R3 dự đoán vòng ba sẽ lộ tầng thứ tư — đó đúng là vòng xoáy mà luật một-vòng
sinh ra để chặn. Đẩy lên bàn chủ dự án kèm một lựa chọn thật, không xin thêm vòng.

**Điều cần nói rõ khi trình:** ba reviewer đã kiểm độc lập và **lược đồ sản phẩm
đúng** — mọi ràng buộc tồn tại và hành xử đúng trên CSDL thật. Mọi phép lọt đều
do reviewer tự tay đục vào lược đồ. Thứ còn thiếu là **độ sâu của hàng rào hồi
quy**, không phải khuyết tật trong thứ WMS-2 giao.
