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

### Lăng kính truy vết yêu cầu
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

### Lăng kính an toàn migration
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

### Lăng kính chất lượng test — 8 phép đột biến, **6 phép để 13/13 xanh nguyên**
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

### Lăng kính truy vết — **APPROVE**, 10/10 finding đóng
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

### Lăng kính migration — **APPROVE**, mọi finding đóng
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

### Lăng kính test — **REQUEST-CHANGES**, 7/8 đột biến cũ nay chết, nhưng 7 phép mới lọt
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

## Lăng kính migration · APPROVE, kèm 6 ghi nhận
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

## Lăng kính test, vòng 1 · CHẶN-1 — vá theo tên đối tượng, không theo lớp
Đo được: 10/12 khoá ngoại · 3/6 chỉ mục duy nhất · `DROP TABLE phien` · mọi phép
đổi kiểu cột — tất cả gỡ được mà **38/38 xanh**. Gồm `so_du_ton_kho_kho_id_fkey`,
một trong ba khoá ngoại R1-F5 gọi thẳng tên. **CHẶN-1b:** REPORT viết "Không phép
nào còn lọt" trong khi liệt kê 2/3 khoá ngoại — cái bỏ ra chính là cái còn lọt.

## Vòng sửa 2 → `d6246d5`
Thay ba danh sách cấm bằng MỘT ảnh chụp lược đồ khẳng định tập cột (kèm độ dài,
nullable) · khoá ngoại (kèm `ON DELETE`) · chỉ mục duy nhất (kèm `NULLS NOT
DISTINCT`) · CHECK · trigger (kèm `ALWAYS`/`ORIGIN`). Cộng M-1, M-2, và fixture
đổi sang băm argon2id dài thật 98 ký tự.

## Lăng kính test, vòng 2 · CHẶN-1 và CHẶN-1b ĐÓNG, nhưng **CHẶN-2**

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


## Lăng kính test, vòng 3 · **APPROVE**

**CHẶN-2 ĐÓNG.** Phép kiểm quyết định chạy lại nguyên văn:

| | `d6246d5` | `5d22374` |
|---|---|---|
| Ảnh chụp tái sinh trên CSDL đã hỏng | **0 dòng khác** | **43 dòng khác** |
| Test | 51/51 xanh | **10 failed / 44 passed** |

9/9 phép N1…N10 chạy riêng đều đỏ. Tuyên bố "test không còn ghi đè fixture" được
R3 kiểm bốn đường: mtime/kích thước/sha256 không đổi kể cả trên CSDL LỆCH; chạy
lần hai vẫn đỏ chứ không tự sửa; import module thuần khi KHÔNG có `DATABASE_URL`
thì nạp được mà không kết nối, không ghi file.

**R3 tìm thêm 11 phép, 9 vẫn lọt — và phân loại TẤT CẢ là nợ ghi chép được**, theo
một quy tắc dừng viết ra giấy TRƯỚC khi chấm: chỉ chặn khi lỗ đi tới được qua
đường thay đổi hợp thức (`schema.prisma` → `prisma migrate`) VÀ phá một bất biến
WMS-2 khẳng định. Đúng một phép (T15, gỡ `@@index`) thoả vế đầu và không thoả vế
sau — nó là hồi quy độ trễ, không phải tính đúng đắn. Mười phép còn lại đòi hành
động DBA ngoài băng với quyền superuser.

**Nợ đã ghi vào `scripts/luoc-do-mat.mjs` §Phạm vi thành thật** (7 mục R3 ĐO, không
phải tác giả đoán): chỉ mục không-duy-nhất · trigger nội bộ (`DISABLE TRIGGER ALL`
làm khoá ngoại còn nguyên mà không thi hành) · `relpersistence` · `proconfig`/
`prosecdef` · `datetime_precision` · RULE và policy RLS · ACL/collation/quyền sở
hữu/sequence/event trigger.

**Hai chỗ hồ sơ của tác giả sai, R3 bắt và đã sửa:** tiêu đề "54 test" trong khi
khối output dán bên dưới ghi `51 passed` (lần thứ năm dán số về công việc của
chính mình mà không kiểm — lần này thấp hơn thực tế, nên là cẩu thả chứ không
phải thổi phồng); và "áp 8 đột biến → 15 dòng" trong khi mục trên nói 9 phép —
nay ghi rõ hai tập đột biến khác nhau cho hai con số khác nhau.

**MY WEAK SPOT của R3, đáng đọc hơn cả finding:**
*"Lời tiên đoán 'sẽ tìm ra tầng thứ tư' nói về PHƯƠNG PHÁP CỦA TÔI, không nói về
công việc của tác giả. Một hàng rào lược đồ có độ sâu không giới hạn; phương pháp
của tôi sinh ra một tầng mới mỗi vòng vô điều kiện, nên 'tôi lại tìm được lỗ' gần
như không mang thông tin về việc công việc đã xong hay chưa."* Và: *"Nếu không có
quy tắc dừng tôi đã chặn vì T14 — cảm giác 'nặng' ấy đến từ công tôi bỏ ra để đào
nó lên, không đến từ rủi ro thật."* Và: *"Ba vòng liền tôi chưa một lần tìm ra
khuyết tật trong SẢN PHẨM — chỉ tìm ra lỗ trong lưới hồi quy của nó."*

### Bằng chứng vòng 3 (đã thực sự chạy trên bản nhân bản `wms2_r3v3`)

1. **Phép kiểm quyết định, chạy lại nguyên văn** — áp cả 9 phép N1…N10 cùng lúc lên
   bản nhân bản, rồi sinh lại ảnh chụp bằng chính `MAT` của tác giả
   (`scripts/luoc-do-mat.mjs:20`) trên CSDL đã hỏng:
   ```
   diff luoc-do.snapshot.json(gốc) luoc-do.snapshot.json(sinh trên CSDL hỏng)
   → 43 dòng khác   (vòng trước: 0 dòng)
   npm run test:integration → 10 failed | 44 passed (54)
   ```
   Cả bảy mặt đều đỏ. Diff chỉ đích danh: `nhat_ky_thao_tac RLS` ·
   `DEFAULT 0→5` · mất `nguoi_dung_kho PRIMARY KEY` · 12 dòng khoá ngoại rụng
   `ON UPDATE CASCADE` · `kho_ma_key … btree (id)` · `… WHERE dang_hoat_dong` ·
   biểu thức CHECK nới ra · `body=1bdcee…→32b3d0…` · `WHEN ((old.dia_chi_ip <> …))`.

2. **9 phép N1…N10 chạy TỪNG CÁI** trên bản nhân bản riêng
   (`scripts/luoc-do-mat.mjs:26-96` là bảy mặt bị nhắm):
   ```
   N1 ON UPDATE CASCADE→NO ACTION ×12  → 1 đỏ, diff 24 dòng
   N2 unique cùng tên, cột khác        → 1 đỏ, diff  2
   N3 unique → partial, giữ tên        → 1 đỏ, diff  2
   N4 CHECK giữ tên, nới biểu thức     → 1 đỏ, diff  2
   N5 đổi DEFAULT                      → 1 đỏ, diff  2
   N6 gỡ khoá chính bảng nối           → 1 đỏ, diff  1
   N8 ENABLE ROW LEVEL SECURITY        → 1 đỏ, diff  2
   N9 cửa hậu trong thân chan_sua_xoa()→ 1 đỏ, diff  8
   N10 thêm WHEN vào trigger           → 4 đỏ, diff  2
   ```
   Vòng trước cả 9 phép này đều 0 đỏ.

3. **Kiểm tuyên bố "test không còn ghi đè fixture"** — bốn đường, nhắm
   `src/lib/__tests__/nen-danh-tinh.itest.ts:14` (import module thuần) và
   `scripts/chup-luoc-do.mjs:31` (nơi duy nhất còn `writeFileSync`):
   ```
   mtime · size · sha256 trước/sau chạy test (CSDL sạch) : 11:23:18 · 8090 · 737347de… → KHÔNG ĐỔI
   … sau chạy trên CSDL LỆCH (thêm kho.cot_la)           : KHÔNG ĐỔI, test 1 failed | 53 passed
   … chạy lần 2 trên cùng CSDL lệch                      : VẪN 1 failed, git status rỗng
   import luoc-do-mat.mjs khi KHÔNG có DATABASE_URL      : nạp được, 7 mặt, không kết nối, không ghi
   ```

4. **11 phép đột biến MỚI**, nhắm vào chỗ bảy mặt có thể vẫn hẹp
   (`scripts/luoc-do-mat.mjs:56` lọc `indisunique`, `:90` lọc `NOT tgisinternal`):
   ```
   T14 DISABLE TRIGGER ALL (trigger nội bộ RI) → 54/54 xanh, diff 0 → chèn được dòng mồ côi
   T15 gỡ cả 6 chỉ mục không-duy-nhất          → 54/54 xanh, diff 0
   T2  SET UNLOGGED hai bảng chỉ-ghi-thêm      → 54/54 xanh, diff 0
   T1  RESET search_path + SECURITY DEFINER    → 54/54 xanh, diff 0
   T12 timestamptz → timestamptz(0)            → 54/54 xanh, diff 0
   T4  CREATE RULE … DO INSTEAD NOTHING        → 3 ĐỎ  (test hành vi bắt, không phải ảnh chụp)
   T10 che bóng lược đồ qua search_path        → 24 ĐỎ, diff 14 dòng
   ```

5. **Cổng chuẩn**: `lint` · `typecheck` · `npm test` 15/15 · `npm run test:integration`
   54/54 trên `PostgreSQL 17.10 · stockflow_wms`.

**Điểm yếu tự nhận:** ba điểm ở trên.

---

# CARD CUỐI CÙNG — 3/3 chữ ký

## R1 · lăng kính truy vết yêu cầu · **APPROVE**

Cả 10 finding vòng 1 đóng, kiểm bằng truy vấn riêng trên CSDL thật, không đọc lại
bảng trong báo cáo của tác giả.

**Tried to break:**
- Chèn thật một dòng nhật ký đăng nhập thất bại với `nguoi_dung_id = NULL`
  (`prisma/schema.prisma:299`): `INSERT … VALUES (NULL,'khong-ton-tai-xyz',…)` →
  `id=41`, đọc lại `n=1`. Trỏ tới `999999` vẫn `23503` ⇒ nullable không làm mất
  toàn vẹn. Finding F2 đóng.
- Xoá `nguoi_dung` còn dấu vết trong sổ (`prisma/schema.prisma:106`) →
  `23503 chuyen_dong_kho_nguoi_thuc_hien_id_fkey`; xoá `kho` →
  `23503 chuyen_dong_kho_kho_id_fkey`. Kiểm bằng HÀNH VI, không bằng catalog.
- Chèn `SELECT 1/0` ngay trước `COMMIT` của
  `prisma/migrations/20260820022117_wms2_nen_danh_tinh/migration.sql` rồi deploy
  lên CSDL trắng → **còn đúng 1 bảng**; `migrate resolve --rolled-back` + deploy
  bản sạch → 12 bảng, seed đủ. Đường phục hồi vòng trước tắc, nay thông.
- Đo pool thay vì đọc code (`src/lib/prisma.ts:20`): bắn 40 truy vấn `pg_sleep`
  đồng thời, `pg_stat_activity` đỉnh 21 (gồm 1 kết nối quan sát) ⇒ trần đúng 20.
- Truy vấn `information_schema`: `timestamp without time zone` = **0**,
  `timestamptz` = 17.

**Điểm yếu tự nhận:** không đọc được AC gốc trong Jira nên chỉ đối chiếu được
giữa ba tài liệu do cùng một tác giả viết; chọn không chặn ở việc hồ sơ review
chưa commit, và tự nhận lựa chọn ngược lại cũng đứng được.

## R2 · lăng kính an toàn migration · **APPROVE**

Mọi finding đóng. Ba đường còn lọt đúng bằng ba đường mà `prisma/migrations/20260820022117_wms2_nen_danh_tinh/migration.sql:275` đã tự khai là
không chặn được — không còn tuyên bố sai sự thật.

**Tried to break:**
- 11 đường tấn công tầng ứng dụng trên bản nhân bản có dữ liệu mồi thật:
  `UPDATE`/`DELETE`/`TRUNCATE` cả hai bảng chỉ-ghi-thêm, `SET
  session_replication_role='replica'` rồi `DELETE` và `TRUNCATE`, `TRUNCATE
  nguoi_dung CASCADE`, `INSERT … ON CONFLICT DO UPDATE`, `MERGE … WHEN MATCHED
  THEN DELETE`, CTE `WITH x AS (UPDATE …)` — tất cả bị chặn bởi `prisma/migrations/20260820022117_wms2_nen_danh_tinh/migration.sql:295`.
- Migration hỏng giữa chừng: chèn một câu lỗi trước `COMMIT` (`prisma/migrations/20260820022117_wms2_nen_danh_tinh/migration.sql:347`) → còn 1
  bảng, `finished_at=NULL`. Đối chứng gỡ `BEGIN;` (`prisma/migrations/20260820022117_wms2_nen_danh_tinh/migration.sql:13`) → **4 bảng rò**.
- Replay từ CSDL trắng bằng `npx prisma migrate deploy` → 12 bảng, `quyen=120
  vai_tro=10 vai_tro_quyen=120`, 4 trigger `tgenabled=A`, 12 khoá ngoại,
  `timestamp without time zone` = 0; bộ test 54/54 trên chính CSDL đó.
- 25 chuỗi thử qua CHECK định dạng băm (`prisma/migrations/20260820022117_wms2_nen_danh_tinh/migration.sql:319`): chặn chuỗi rỗng, `$argon2xx$`,
  MD5/SHA256 hex, `$2x$`, chữ hoa, khoảng trắng đầu; lọt `$2b$` cụt và mật khẩu
  rõ vô tình bắt đầu bằng `$2b$` — đúng phạm vi chú thích đã tự khai.
- Đối chứng drift: có `map:` ở `prisma/schema.prisma:69` → `npx prisma migrate
  diff` rỗng; gỡ `map:` → `ALTER INDEX … RENAME TO …`.

**Điểm yếu tự nhận:** chạy toàn bộ với vai `postgres` = chủ sở hữu bảng, nên
"trigger không chặn được chủ sở hữu" là điều xác nhận chứ không phải giải quyết;
chỉ một node, không replication; không chạy được workflow CI thật.

## R3 · lăng kính chất lượng test · **APPROVE**

CHẶN-2 đóng. Chín phép đột biến từng lọt nay đều đỏ; phép kiểm quyết định cho 43
dòng khác thay vì 0. Chỗ hở còn lại được phân loại là nợ ghi chép được, theo một
quy tắc dừng viết ra giấy trước khi chấm.

**Tried to break:**
- Phép kiểm quyết định: áp cả 9 phép N1…N10 cùng lúc rồi sinh lại ảnh chụp bằng
  chính `MAT` ở `scripts/luoc-do-mat.mjs:20` trên CSDL đã hỏng → **43 dòng khác**
  (vòng trước 0) và `npm run test:integration` cho **10 failed / 44 passed**.
- 9 phép chạy RIÊNG từng cái, nhắm bảy mặt ở `scripts/luoc-do-mat.mjs:26`: N1 →
  1 đỏ/diff 24 · N2 → 1/2 · N3 → 1/2 · N4 → 1/2 · N5 → 1/2 · N6 → 1/1 · N8 → 1/2
  · N9 (cửa hậu trong thân hàm) → 1/8 · N10 → 4 đỏ/diff 2. Vòng trước cả 9 đều 0 đỏ.
- Bốn đường kiểm "test không còn ghi đè fixture", nhắm
  `src/lib/__tests__/nen-danh-tinh.itest.ts:14` và `scripts/chup-luoc-do.mjs:31`:
  mtime/size/sha256 không đổi kể cả trên CSDL LỆCH; chạy lần hai vẫn đỏ chứ không
  tự sửa; import module thuần khi không có `DATABASE_URL` thì không kết nối.
- 11 phép đột biến MỚI nhắm chỗ bảy mặt còn hẹp — `scripts/luoc-do-mat.mjs:56`
  (lọc `indisunique`) và `scripts/luoc-do-mat.mjs:90` (lọc `NOT tgisinternal`):
  9 phép lọt (T14, T15, T2, T1, T12, T13, T5, T6, T7), 2 phép bị bắt (T4 → 3 đỏ
  bởi test hành vi, T10 → 24 đỏ).
- Cổng chuẩn: `npm run lint` · `npx tsc --noEmit` · `npm test` 15/15 ·
  `npm run test:integration` 54/54 trên `PostgreSQL 17.10 · stockflow_wms`.

**Hai phương án đã cân, và tiêu chí phân định (A vs B):**

| | **Phương án A — chặn merge** | **Phương án B — ghi thành nợ** |
|---|---|---|
| Lập luận | Còn 9 phép đột biến lọt; T14 làm khoá ngoại còn nguyên trong `pg_constraint` mà không còn thi hành, chèn được dòng mồ côi ⇒ BR-22 vỡ | Lược đồ sản phẩm đúng; mọi phép lọt đều do reviewer tự tay đục vào, không đi tới được qua `prisma migrate` |
| Giá phải trả | Một vòng nữa, mà chính reviewer dự đoán sẽ lộ tầng thứ năm — hàng rào lược đồ có độ sâu không giới hạn | Bảy mục nợ nằm trong `scripts/luoc-do-mat.mjs:14` chờ ticket sau; nếu một mục thành lỗ thật thì phát hiện muộn hơn |
| Rủi ro thật hôm nay | T14/T5/T13/T6 đòi quyền superuser hoặc chủ sở hữu — cùng họ với `DROP TRIGGER` mà `prisma/migrations/20260820022117_wms2_nen_danh_tinh/migration.sql:275` đã tự khai là không chặn nổi | Cụm chỉ có MỘT role (`postgres`) và ứng dụng kết nối bằng chính nó; ACL/RLS/quyền sở hữu chỉ có nghĩa sau khi OPN-03 đẻ ra role ứng dụng |

**Tiêu chí phân định, viết ra giấy TRƯỚC khi chấm:** chỉ chặn khi lỗ (a) đi tới
được qua đường thay đổi hợp thức (`prisma/schema.prisma` → `prisma migrate`) **và**
(b) phá một bất biến mà chính WMS-2 khẳng định. Trong 11 phép mới, đúng **một**
(T15, gỡ `@@index`) thoả (a), và nó **không** thoả (b) — gỡ chỉ mục là hồi quy độ
trễ, không phải tính đúng đắn, và độ trễ có làn đo riêng. **Chọn B.**

Không có tiêu chí này thì reviewer đã chọn A vì T14 — và tự nhận rằng cảm giác
"nặng" của T14 đến từ công bỏ ra để đào nó lên, không từ rủi ro thật của nó.

**Điểm yếu tự nhận:** *"lời tiên đoán 'sẽ tìm ra tầng thứ tư' nói về phương pháp
của tôi, không nói về công việc của tác giả"*; *"nếu không có quy tắc dừng tôi đã
chặn vì T14, và cảm giác nặng ấy đến từ công tôi bỏ ra để đào nó lên"*; *"ba vòng
liền tôi chưa một lần tìm ra khuyết tật trong sản phẩm — chỉ tìm ra lỗ trong lưới
hồi quy của nó."*

---

# KẾT: 3/3 chữ ký · WMS-2 đủ điều kiện merge

| Reviewer | Lăng kính | Vòng cuối |
|---|---|---|
| R1 (opus) | truy vết yêu cầu | **APPROVE** — 10/10 finding đóng |
| R2 (opus) | an toàn migration | **APPROVE** — 11/11 đường tấn công tầng ứng dụng bị chặn |
| R3 (opus) | chất lượng test | **APPROVE** — CHẶN-2 đóng, còn lại là nợ ghi chép được |

Tổng: **3 lần thử · 5 vòng review · 12 + 3 + 2 finding chặn**. Ticket ước lượng
1,5 pd. Điều đáng giữ lại không phải con số đó mà là hình dạng của các finding:
vòng 1 bắt lỗi trong sản phẩm; vòng 2–3 bắt lỗi trong hàng rào; vòng 4–5 bắt lỗi
trong hàng rào của hàng rào. Và ở vòng cuối, chính reviewer là người nói ra rằng
tầng tiếp theo sẽ luôn tồn tại — nên điểm dừng phải là một quy tắc viết trước,
không phải cảm giác đã đủ.
