# WMS-3 — hồ sơ review

Diff `develop...HEAD`. **High-stakes**: chạm `prisma/schema.prisma` và
`prisma/migrations/` ⇒ ba người review theo `review.high_stakes_paths`.

## Vòng 1 — commit 66bb42e · ba thẻ, ba REQUEST-CHANGES

Không thẻ nào duyệt. Ba người soi ba góc độc lập và **trùng nhau ở hai lỗi nặng
nhất**, điều đó làm chúng đáng tin hơn là nếu chỉ một người tìm ra.

### R1 — tính đúng đắn nghiệp vụ và bảo mật xác thực · REQUEST-CHANGES

- **Cuộc đua bộ đếm.** `src/lib/dang-nhap.ts:42` đọc rồi `src/lib/dang-nhap.ts:61`
  ghi đè bằng giá trị tuyệt đối, ngoài giao dịch. Đo: 5 lượt sai song song ⇒
  `soLanSaiLienTiep=2`, không khoá, mật khẩu đúng vẫn vào được. AC3 thủng.
- **Thông báo khoá phát 3 lần** cho một lần khoá — cùng gốc.
- **Kênh phụ thời gian.** Bấm giờ 15 vòng xen kẽ: không tồn tại 76,2 ms · sai mật
  khẩu 6,8 ms · đang khoá 0,6 ms · vô hiệu hoá 0,5 ms — bốn phân bố không giao
  nhau. Băm giả cắm cứng `ln=16` trong khi 0/214 hàng dùng tham số đó.
- **`src/lib/phien.ts:36` là hạn tuyệt đối**, không phải "30 phút không thao tác".
- 6 QUESTION: gáo đếm chung là DoS chủ động · cửa sổ cố định cho 40 lượt/1 ms ·
  ngưỡng cắm cứng nhưng AC8 nói "cấu hình" · định danh phân biệt hoa/thường và
  NFD · `findFirst` với OR không `orderBy` · `src/lib/khoa-tam.ts:44` là đường chết.
- Kiểm chứng lại **mọi** con số trong `REPORT.md` — tất cả tái lập được.
- Traces: `src/lib/dang-nhap.ts:61` · `src/lib/khoa-tam.ts:28` · `src/lib/phien.ts:36`
  · lệnh `npm run test:integration` · `python3 .vteam/scripts/gate.py e2e`

### R2 — lược đồ, migration, tầng web · REQUEST-CHANGES

- **Tiền đề trung tâm SAI.** `node_modules/next/dist/server/base-server.js:612`
  có `req.headers['x-forwarded-for'] ??= originalRequest?.socket?.remoteAddress`.
  Chạy `TIN_HEADER_IP=1 npm run test:e2e` ⇒ `expected '::ffff:127.0.0.1' to be null`.
  Câu sai đã được chép vào **năm** chỗ, gồm một migration và một câu hỏi gửi chủ dự án.
- **Nới NULL không đóng đúng lỗ nó viện dẫn.** Gửi `x-forwarded-for: khong-phai-ip`
  rồi sai 5 lần ⇒ tài khoản khoá thật, POST thứ 5 trả 500, **0 dòng** nhật ký.
- **Cấu hình mặc định = DoS.** 24 lượt/phút từ một trình duyệt vô danh chặn cửa
  đăng nhập của toàn hệ thống; người thật gõ đúng mật khẩu vẫn bị chặn.
- **Lấy phần tử trái nhất của `x-forwarded-for`** = lấy đúng phần khách tự ghi;
  25 lượt xoay vòng header, 0 bị chặn.
- **FR-01-08 chưa cài mà migration viện dẫn nó**: 145 lượt đăng nhập thành công,
  0 dòng nhật ký.
- Migration thiếu `lock_timeout` (đo `SELECT` trên `phien` kẹt 5108 ms) ·
  `src/e2e/may-chu.ts:29` không ghim môi trường · `secure` có điều kiện trái ADR-0002.
- Thử phá **không được**: CSRF (Next 16 chặn thật) · 4 trigger vẫn `ENABLE ALWAYS`
  · ảnh chụp lược đồ sinh lại khớp 0 khác biệt.
- Traces: `src/app/login/hanh-dong.ts:34` · `src/lib/gioi-han-tan-suat.ts:23` ·
  `src/lib/phien.ts:49` · lệnh `TIN_HEADER_IP=1 npm run test:e2e`

### R3 — chất lượng bằng chứng và quyết định kiến trúc · REQUEST-CHANGES

- **C1 cuộc đua** (độc lập trùng R1), đo qua trình duyệt thật trên bản build sản xuất.
- **C2 kênh phụ**: 78,2 / 79,4 / 0,4 / 0,4 ms — B/D = 200×.
- **C3 "0/130" không tái lập**: mẫu số hôm nay là 380 và tăng +19 mỗi lượt
  `test:integration`; hàng không xoá được vì BRULE-13/DI-07. Hãy ghi **bất biến**,
  đừng ghi mẫu số.
- **C4 "73 test xanh trong lúc ứng dụng hỏng" là con số không thể đúng** — 3 trong
  73 test đó chỉ tồn tại vì lỗi ấy. Lúc lỗi còn sống, bộ tích hợp là **70**.
- **C5 migration trích sai FR-01-08** (FR-01-08 nói "mọi lần đăng nhập thành công
  và thất bại", thuộc S-07; dòng khoá truy vết FR-01-02).
- **C6 công thức tái lập trong manifest không chạy được** — cổng ngẫu nhiên,
  máy chủ bị giết trong `afterAll`, và `design_vs_app.png` không do lệnh nào sinh ra.
- **C7 `don()` là mã chết** — `grep -rn "don(" src/` chỉ ra định nghĩa.
- **So sánh phương án** (bắt buộc trên diff high-stakes): A nullable · B giữ
  NOT NULL + chặn khởi động · C tách hai đòn bẩy. Kết luận của R3: **A đúng hơn B**
  — R3 tự ghi được địa chỉ giả `203.0.113.99` vào CSDL ở phương án B, và một địa
  chỉ giả trong sổ chỉ-ghi-thêm tệ hơn một ô trống trung thực. **Không ship B.**
- Traces: `src/lib/dang-nhap.ts:50` · `src/e2e/dang-nhap.e2e.ts:117` ·
  `evd/WMS-3/REPORT.md:28` · lệnh
  `npx vitest run --config vitest.integration.mts -t "IP không xác định được"`

## Vòng sửa — một vòng duy nhất, theo luật /dev

| # | Phát hiện | Đã đổi gì | Bằng chứng |
|---|---|---|---|
| R1·1, R3·C1 | cuộc đua bộ đếm | `ghiLanSai` bọc `$transaction` + `SELECT … FOR UPDATE`; luật đếm vẫn nằm nguyên ở `khoa-tam.ts`, không chép sang SQL | test "năm lần sai SONG SONG vẫn khoá" và "hai mươi lượt song song dừng ĐÚNG ở ngưỡng" |
| R1·2 | thông báo phát 3 lần | `vuaBiKhoa` tính từ bản đọc BÊN TRONG giao dịch | cùng test trên, `expect(daPhat).toHaveLength(1)` |
| R1·3, R3·C2 | kênh phụ thời gian | mọi nhánh đều băm; băm giả dùng `MAC_DINH` thay vì `ln=16` cắm cứng; **sàn thời gian** `SAN_TU_CHOI_MS` cho MỌI lượt từ chối | `kenh-phu-thoi-gian.txt` — đo QUA HTTP: 305,6/306,2/306,1/303,6 ms, tỉ lệ **1,01×** |
| R1·4, R2·F6 | phiên hết hạn tuyệt đối | `docPhien` gia hạn `hetHanLuc` cùng lúc ghi thao tác cuối | test FR-01-07: thao tác mỗi 10 phút, phiên sống tới phút 40; im 31 phút thì chết |
| R2·F1 | tiền đề sai về địa chỉ socket | `server.mjs` luôn nối địa chỉ socket vào cuối header; `src/lib/dia-chi-ip.ts` đọc phần tử thứ (N+1) từ PHẢI sang; câu sai gỡ khỏi cả 5 chỗ | `grep -c TIN_HEADER_IP` trên 5 file = 0; e2e ghi `127.0.0.1` thay vì null |
| R2·F2 | IP rác làm mất dòng nhật ký | `chuanHoa` từ chối mọi thứ không phải IP; cặp ghi bộ đếm + nhật ký vào CÙNG giao dịch | test "IP rác KHÔNG được làm mất dòng nhật ký" và "cùng vào hoặc cùng không" |
| R2·F3, R1·Q1 | gáo đếm chung = DoS | khoá đếm là `ip:` khi biết IP, `dd:<định danh>` khi không — không còn gáo toàn cục | e2e "một máy gõ sai liên tục KHÔNG chặn được máy khác đăng nhập" |
| R2·F4 | lấy phần tử trái nhất | đọc từ PHẢI sang theo `IP_SO_HOP_TIN_CAY`; khai quá tay thì trả null | `src/lib/__tests__/dia-chi-ip.test.ts` (15 test) + e2e chống giả mạo |
| R2·F5, R3·C5 | trích sai FR-01-08 | viết lại lý lẽ migration; nói rõ FR-01-08 thuộc S-07 và CHƯA cài | `prisma/migrations/20260820061500_dia_chi_ip_co_the_khong_biet/migration.sql` |
| R2·F7 | migration thiếu `lock_timeout` | thêm `SET LOCAL lock_timeout = '3s'` + ghi rõ câu lệnh đường lùi | dựng lại toàn bộ migration từ CSDL trống: sạch, 4 trigger còn nguyên |
| R2·F8 | e2e không ghim môi trường | `moMayChu(moiTruong)` ghi đè env; chạy `server.mjs` chứ không `next start` | `src/e2e/may-chu.ts` |
| R2·F9 | `secure` có điều kiện | `secure: true` không điều kiện, theo ADR-0002 | `src/app/login/hanh-dong.ts` |
| R1·Q3 | ngưỡng cắm cứng | `TAN_SUAT_NGUONG`, `TAN_SUAT_CUA_SO_MS`, `SAN_TU_CHOI_MS` đọc từ môi trường | `.env.example` |
| R1·Q4 | định danh không chuẩn hoá | `normalize('NFC')` như mật khẩu | `src/lib/dang-nhap.ts` |
| R1·Q5 | `findFirst` OR không xác định | `findMany take 2` rồi ưu tiên khớp tên đăng nhập | `src/lib/dang-nhap.ts` |
| R1·Q6 | `src/lib/khoa-tam.ts:44` đường chết | giờ CHẠY THẬT: 20 lượt song song dừng ở đúng ngưỡng 5 | test tương ứng |
| R2·Q-B, R3·C7 | `don()` mã chết | `chapNhan` gọi `don()` khi bảng vượt 10 000 mục | `src/lib/gioi-han-tan-suat.ts` |
| R3·C3 | mẫu số "0/130" trôi | báo cáo ghi **bất biến** ("0 hàng ngoài danh sách cho phép") kèm mốc thời gian, không ghi mẫu số như sự thật cố định | `evd/WMS-3/dev/mat-khau-trong-csdl.txt` |
| R3·C4 | "73 test" sai | sửa thành **70** ở đúng câu nói về lỗi lược đồ trong REPORT | `REPORT.md` |
| R3·C6 | công thức tái lập không chạy | **một lệnh** `npm run evidence` tự dựng máy chủ, chụp, đo, ghép, dọn | `scripts/chup-bang-chung.mjs` |
| R3·Q-A | "khớp tuyệt đối" gồm một khớp mềm | tách riêng trong `fidelity.md` | `evd/WMS-3/dev/fidelity.md` |

### Không sửa, và nói rõ vì sao

- **R3 · phương án C2 (cột `nguon_ip`)** — không cài. Sau khi sửa F1, địa chỉ
  nguồn là địa chỉ thật ở cấu hình mặc định, nên `NULL` chuyển từ "trạng thái
  thường trực" thành "ngoại lệ hiếm"; giá trị của một cột phân loại độ tin giảm
  hẳn. Thêm cột vào bảng chỉ-ghi-thêm là một chiều, và chính R3 tự ghi trong
  MY WEAK SPOT rằng chưa chạy thử migration đó. Ghi thành đề xuất cho S-07, nơi
  FR-01-08 thật sự được cài.
- **R3 · phương án C3 (chặn khởi động nếu chưa cấu hình)** — không cài. Nó tồn
  tại để chống trạng thái "mặc định là không biết"; trạng thái đó không còn.
  Mặc định `IP_SO_HOP_TIN_CAY=0` giờ là một mặc định ĐÚNG, không phải một tai nạn.
- **R1 · Q2 cửa sổ cố định cho 40 lượt/1 ms** — không sửa. Nó nằm trong cùng món
  nợ đã ghi với "bộ đếm trong tiến trình" và phụ thuộc OPN-03; sửa nửa vời một
  bộ đếm sắp bị thay bằng kho đếm dùng chung là làm việc hai lần. Đã ghi rõ trong
  đầu tệp `src/lib/gioi-han-tan-suat.ts`.
- **Đăng nhập không phân biệt hoa/thường** — không cài. Muốn đúng thì phải đổi
  chỉ mục duy nhất sang dạng hàm (`lower(...)`), nếu không hai tài khoản chỉ khác
  hoa/thường sẽ va nhau và việc "đăng nhập được" trở thành không xác định. Đó là
  một migration chạm SC-20; ghi thành nợ chứ không làm vội trong vòng sửa này.

## Vòng 2 — tái review commit `c4f4067` · ba thẻ, ba REQUEST-CHANGES

Mỗi người chỉ xét những gì chính họ nêu ở vòng 1, và **chạy lại thí nghiệm của
chính mình** chứ không đọc bảng đối chiếu rồi gật.

### Đã đóng thật (cả ba xác nhận độc lập)

| Phát hiện vòng 1 | Ai xác nhận | Phép đo của họ |
|---|---|---|
| Cuộc đua bộ đếm (nhánh SAI) | R1, R3 | R1: 5 song song · 5 lô × 4 · **40 song song** ⇒ luôn dừng đúng ngưỡng 5. R3: **15 Chromium độc lập** bấm cùng lúc trên bản build sản xuất ⇒ đếm 5, một dòng nhật ký, mật khẩu đúng sau đó vẫn bị từ chối |
| Thông báo phát 3 lần | R1 | 4 tuần tự + 3 song song, cả cổng giả lẫn cổng thật ⇒ đúng 1 |
| Phiên hết hạn tuyệt đối | R1, R2 | R1 thử thêm **biên gộp ghi** mà tôi chưa thử: thao tác mỗi 59 giây (dưới `GOP_GHI_MS`) ⇒ vẫn sống qua phút 44 |
| Tiền đề sai về địa chỉ socket (ở cấu hình mặc định) | R2 | khách khai `203.0.113.99` ⇒ CSDL ghi `::ffff:127.0.0.1`; 25 lượt xoay vòng header ⇒ chặn đúng ngưỡng |
| IP rác làm mất dòng nhật ký | R2 | thí nghiệm cũ giờ để lại đúng 1 dòng với `dia_chi_ip = NULL` |
| Gáo đếm chung = DoS | R1, R2 | 25 lượt của một khoá không chặn được khoá khác |
| `secure` có điều kiện | R2 | đo cookie thật trên `http://127.0.0.1`: `secure=true` và Chromium vẫn nhận |
| Mẫu số trôi · trích sai FR-01-08 · `don()` mã chết · công thức tái lập | R3 | chạy đúng `npm run build && npm run evidence`: cả 7 PNG sinh mới, `fidelity.json` giống hệt bản commit |
| Ngưỡng cấu hình · chuẩn hoá NFD · `findFirst` OR | R1 | dựng đúng va chạm tên/email, 8/8 lượt ra cùng một người |
| Cửa sổ đếm cố định — lý do TỪ CHỐI | R1 | tái lập được 39 lượt/1 ms, nhưng chấp nhận: hệ số 2× nằm gọn trong hệ số R× đã ghi nợ, và gáo tần suất không phải phòng tuyến chống dò |
| Hai đề xuất `nguon_ip` / chặn khởi động — lý do TỪ CHỐI | R3 | *"cả hai đứng vững, không phải né việc"* — R3 tự ghi rằng `nguon_ip` đúng là loại đề-xuất-chưa-kiểm mà chuẩn review cảnh báo |

### Còn mở — bốn khiếm khuyết, đều có phép đo

**M1 · Kênh phụ thời gian mở lại khi gửi ĐỒNG THỜI** (R1). Sàn chỉ che khi còn bó.
Quét mức đồng thời K = 1/4/12/24 ⇒ 1,00× → 1,00× → 1,19× → **2,37×**. Dạng tấn
công thật (20 lượt đồng thời cho một tên, 5 vòng): "không tồn tại" 471–497 ms vs
"có thật" 257–281 ms, **min(không) > max(có)** — tách sạch bằng một chùm thăm dò.
Gốc: băm giả `MAC_DINH` = `ln=16` (~79 ms) trong khi phần lớn hàng thật `ln=12`
(~5,5 ms). Việc tôi đổi hằng số cắm cứng sang `MAC_DINH` là **dọn dẹp hình thức,
không đổi hành vi** — `MAC_DINH` chính là `ln=16`. R1 chứng minh nhân quả: nhánh
"tài khoản CÓ THẬT nhưng hàng `ln=16`" bám sát nhánh "không tồn tại", tức tín
hiệu đi theo **tham số chi phí của hàng**, không đi theo nhánh. Và quần thể tham
số lệch nhau là **trạng thái dừng đã thiết kế** của NFR-SEC-03, không phải rác
test: nâng `MAC_DINH` là mở lại lỗ. Hướng sửa (R1 phương án B): băm giả lấy tham
số theo quần thể thật, giữ sàn làm lớp hai.

**M2 · Nhánh THÀNH CÔNG vẫn ghi giá trị tuyệt đối ngoài giao dịch** (R1). Tôi mới
sửa nửa nhánh sai. `sauKhiDung()` + `update` đọc từ bản cũ, không khoá hàng. Quét
độ trễ: **5/10 điểm ở tầng thư viện và 1/19 qua HTTP** cho thấy một khoá 30 phút
**đã commit** bị xoá sạch, trong khi dòng `KHOA_TAM_TAI_KHOAN` ở lại vĩnh viễn
trong bảng chỉ-ghi-thêm. Sổ kiểm toán ghi một sự kiện chưa từng xảy ra, và
BRULE-13 cấm sửa — đúng trạng thái DI-07 sinh ra để chặn, chỉ soi gương so với
lỗ tôi vừa vá.

**M3 · `IP_SO_HOP_TIN_CAY` khai thừa thì hỏng-MỞ** (R2 CONFIRMED-1, R3 C8). Kẻ
tấn công **đệm** header cho đủ số chặng đã khai. R2 đo: khai N=1 khi có 0 proxy
⇒ `203.0.113.99/32` vào CSDL, và 25 lượt xoay vòng header ⇒ **0/25 bị chặn**
(đối chứng cùng máy chủ, cùng một địa chỉ: 5/25 bị chặn — bộ đếm vẫn chạy, chỉ
là khoá đếm rơi vào tay khách). Cùng khuôn bệnh với vòng 1: một câu chưa kiểm
chép đi nhiều chỗ, kèm test viết theo đầu vào mà kẻ tấn công không bao giờ gửi.
**Lời hứa sai đã gỡ khỏi cả sáu chỗ và hai test giờ ghi lại đúng hành vi thật;
bản thân khiếm khuyết CHƯA sửa.** Hướng: danh sách CIDR proxy tin cậy.

**M4 · `server.mjs` mất hai hành vi sản xuất của `next start`** (R2 CONFIRMED-2).
`PORT=abc` hoặc cổng bận ⇒ **thoát mã 0** (`next start` thoát 1), vì `.listen`
không gắn handler `'error'` và Next đã cài sẵn `uncaughtException` chỉ ghi log —
mọi supervisor `Restart=on-failure` sẽ không khởi động lại. SIGTERM giữa một
request đang bay ⇒ **cắt ngang**; `next start` chờ xong rồi thoát 143. Mỗi lần
rolling deploy cắt các lượt đăng nhập đang chạy, vốn dài tối thiểu 250 ms vì
chính cái sàn ở M1. R3 bổ sung: mất cả `keepAliveTimeout` (mặc định Node 5 s so
với ALB 60 s — công thức sinh 502) và `server.on('upgrade')`.

### Còn mở — bốn mục nhỏ hơn

- **M5** bộ e2e mới ghim 1 trong 4 biến môi trường; `TAN_SUAT_NGUONG=5 npm run test:e2e` vẫn đỏ **bằng môi trường**. R2 đo chính xác: e2e tiêu **12/20** hạn mức, dư 8 — thêm ba test có gõ mật khẩu là bộ e2e tự đầu độc.
- **M6** file migration bị sửa **sau khi** áp dụng ⇒ `prisma migrate dev` trên máy đã chạy nó đòi xoá sạch CSDL. R2 kiểm: `migrate status`/`deploy` và CI đều lành, dựng lại từ CSDL trống sạch, 4 trigger còn nguyên — chỉ `migrate dev` là vướng.
- **M7** `docs/specs/changes.md` tự đặt luật "đổi ràng buộc sống ở đây" và đã có tiền lệ y hệt ở WMS-2, nhưng không có mục nào cho `dia_chi_ip`.
- **M8** `don()` chỉ xoá mục HẾT HẠN; nếu 10 001 khoá đều còn sống thì mỗi request trả giá một lượt quét O(n) mà không giải phóng được gì. Không test nào chạm nhánh đó.

### Kết luận vòng 2

Ba thẻ REQUEST-CHANGES. Theo luật một-vòng-phản-biện của /dev, **không có vòng
thứ ba trong lượt dispatch này** ⇒ WMS-3 ghi `failed`, không merge.

Đã làm ngay, vì đây là **đính chính hồ sơ chứ không phải đổi hành vi**: gỡ lời
hứa sai khỏi sáu chỗ (M3), sửa hai test đang khoá lời hứa đó lại, sửa con số 70
bị bê sang hai câu nó không đúng, sửa phân rã 59 → 58 khớp tuyệt đối, sửa trích
dẫn `src/lib/khoa-tam.ts:44` thiếu tiền tố (nó làm `review_check.py` đỏ), sửa hai
tên test trích nhầm FR-01-08, đính chính biên bản phiên, hạ **AC7 xuống CHƯA
ĐẠT**, và sửa chính công cụ đo kênh phụ (mỗi mẫu một tài khoản mới + khẳng định
bằng trạng thái CSDL thay vì bằng câu chữ) rồi đưa nó vào `npm run evidence`.

M1, M2, M4 và M5–M8 là thay đổi hành vi ⇒ để nguyên, chờ vòng dispatch sau.

---

# Lần thử 2 — commit sau `39f71fc`

Tám khiếm khuyết M1–M8 mà vòng 2 để lại, cộng AC4 vừa được gỡ chặn ở Q7.

| # | Khiếm khuyết | Đã đổi gì | Bằng chứng |
|---|---|---|---|
| M1 | kênh phụ mở lại khi gửi đồng thời | băm giả lấy tham số theo **quần thể thật** (`thamSoPhoBienNhat`), không theo `MAC_DINH`; sàn thời gian **tự nâng** nếu đo được một lần băm đắt hơn | `do-kenh-phu.mjs` nay có vòng ĐỒNG THỜI: 24 lượt cùng lúc ⇒ **1,11×**, các khoảng chồng lấn. Chính phép đo này từng cho 2,37× và tách sạch |
| M2 | nhánh THÀNH CÔNG ghi ngoài giao dịch | bọc `$transaction` + `SELECT … FOR UPDATE`, **đọc lại `dangBiKhoa` bên trong** giao dịch trước khi xoá bộ đếm | `src/lib/dang-nhap.ts` |
| M3 | `IP_SO_HOP_TIN_CAY` khai thừa hỏng-MỞ | bỏ hẳn mô hình đếm chặng; thay bằng **danh sách CIDR proxy tin cậy** (`IP_PROXY_TIN_CAY`) | 32 test đơn vị ở `src/lib/__tests__/dia-chi-ip.test.ts`, gồm test đệm header 0/1/2/5/20 phần tử đều không dịch được kết quả |
| M4 | `server.mjs` thoát 0 khi hỏng, cắt request khi SIGTERM | thêm handler `'error'` → `exit(1)`, tắt êm SIGTERM/SIGINT có trần 20 giây, `keepAliveTimeout` cấu hình được, định tuyến `upgrade` | `src/e2e/may-chu.e2e.ts` — 4 test |
| M5 | e2e ghim 1/4 biến môi trường | ghim cả bốn trong `moMayChu`; ngưỡng tần suất sản xuất được kiểm ở một máy chủ riêng | `src/e2e/may-chu.ts` |
| M6 | migration sửa sau khi áp dụng | đồng bộ checksum trong `_prisma_migrations` (sổ sách migration, không đụng dữ liệu) | `npx prisma migrate status` → up to date |
| M7 | `changes.md` thiếu mục nullability | đã thêm, kèm lý do và tiền lệ WMS-2 | `docs/specs/changes.md` |
| M8 | `don()` chỉ xoá mục hết hạn | thêm bước xoá theo thứ tự chèn khi bảng vượt ngưỡng còn sống | `src/lib/gioi-han-tan-suat.ts` |
| Q7 | AC4 chưa đạt | bộ nối SMTP thật + `guiSau` chạy **sau** commit và **không** được await | `src/lib/__tests__/thong-bao-smtp.itest.ts` (10 test, máy chủ SMTP thật trong tiến trình) + 2 test khẳng định lượt gửi không nằm trong đường phản hồi |

Một lỗi do chính vòng sửa này sinh ra và bộ e2e bắt ngay trong lần chạy đầu:
`getUpgradeHandler()` gọi **trước** `prepare()` làm tiến trình chết lúc khởi động.
Ghi lại vì đó đúng là thứ tầng e2e sinh ra để bắt.

Một lỗi trong chính test của tôi, cùng khuôn với KI-003: máy giữ cổng bind
`127.0.0.1` trong khi `server.mjs` bind mọi giao diện ⇒ hai bên không va nhau và
test "cổng đang bận" đo nhầm. Đã sửa và ghi chú tại chỗ.

## Lần thử 2 · vòng 2 — ba thẻ REQUEST-CHANGES

Ba reviewer soi lại đúng vùng của mình. **Hai trong ba phát hiện nặng nhất là do
chính vòng sửa trước sinh ra**, và một là lỗi cũ tái phát qua một lớp chuỗi khác.

| # | Phát hiện | Ai | Đã đổi gì |
|---|---|---|---|
| N1 | `net.isIP('fe80::1%lo0')===6` nhưng Postgres `inet` từ chối, mà Node TRẢ VỀ đúng dạng đó trong `remoteAddress`. Ở cấu hình mặc định: lần sai thứ năm ném lỗi ⇒ cả giao dịch cuộn ⇒ bộ đếm đứng ở 4 **vĩnh viễn**, dò mật khẩu không giới hạn, sổ trống | R2 | `chuanHoa` cắt zone id và hợp lệ hoá theo ngữ pháp của **đích**; **và** `ghiVetKhoa` bọc SAVEPOINT. Hành vi đúng (R2 xác nhận bằng lỗi Postgres thật). ⚠️ Nhưng **chốt thứ hai không có người canh**: test giả lập bằng `throw` của JS, mà `throw` không đưa giao dịch vào trạng thái aborted. Tôi tự chạy đột biến — chú thích cả 4 câu SAVEPOINT ⇒ **104/104 test vẫn xanh** |
| N2 | sàn thời gian **tự nâng** là đòn DoS bấm được từ xa: một chùm 96 lượt làm đồng hồ tường đọc 2093 ms ⇒ sàn nhảy lên 3140 ms và không bao giờ hạ | R1 | bỏ hẳn cơ chế tự nâng. ⚠️ **Câu "chỉ còn cảnh báo" là SAI** — vòng 3 chứng minh không còn cảnh báo nào cả (`grep console.warn src/lib/dang-nhap.ts` rỗng). Sàn nay là hằng số gõ tay không liên hệ gì với `MAC_DINH`; hạ chi phí băm là mất lớp hai trong im lặng. Đồng hồ tường không phân biệt được chi phí băm với thời gian xếp hàng, nên một cơ chế tự chỉnh mà kẻ tấn công lái được thì tệ hơn một hằng số sai |
| N3 | kênh phụ chưa đóng — băm giả theo **mốt** thì mọi nhóm khác vẫn lộ. R3 đổi đúng một con số trong công cụ đo của tác giả (`ln=14`→`ln=16`): script tự in "chưa đạt", **exit 1**, 2,50× và hai phân bố rời hẳn | R1, R3 | cân **công việc** thay vì tìm hằng số: hàng tham số cũ được bù một lần băm ở tham số hiện hành, cộng `napCapBam` hội tụ quần thể. ~~Phép đo nay quét ba bậc; 24 lượt đồng thời cho 1,04× / 1,05×~~ ⚠️ **BỊ BÁC Ở VÒNG 3 — xem §Vòng 3.** Con số 1,05× là tạo tác của dụng cụ, không phải tính chất của hệ thống: khoảng tin cậy của chính công cụ rộng 682 ms trong khi tín hiệu cần bắt là 8–164 ms. R1 đo bằng khách HTTP thô: hàng `ln=14` (211 hàng THẬT trong CSDL) chậm hơn **1,23–1,31×**, khoảng rời hẳn, 6/6 và 8/8 vòng |
| N4 | sổ ghi `SE_GUI` trong khi tiến trình vừa in "không có thư nào được gửi" — hai chỗ đọc cấu hình SMTP theo hai luật | R1 | một nguồn sự thật: `taoCongGhiNhatKy(coHaTang)`, và `trangThaiThu` không còn tự đọc biến môi trường |
| N5 | thư **mất im lặng** khi tiến trình chết giữa commit và lượt gửi; sổ đứng vĩnh viễn ở lời hứa | R2, R3 | `src/lib/doi-soat-thu.ts` — đối soát trên chính sổ chỉ-ghi-thêm (outbox đã tồn tại sẵn), khoá tư vấn chống gửi trùng, `npm run mail:reconcile`. **0 migration, 0 tiến trình mới** — đúng phương án C của R3 |
| N6 | `PORT=99999` thoát mã **0** (`listen` ném đồng bộ nên handler `error` không chạy) | R2 | trần 65535 trong `soDuong`, và bảy ca biên trong test |
| N7 | một socket `Upgrade` treo làm MỌI lần SIGTERM mất 20 giây rồi thoát mã 1 | R2 | ~~theo dõi và destroy socket Upgrade~~ ⚠️ **BẢN SỬA NHẮM SAI CƠ CHẾ — xem §Vòng 3.** R2 tự rút: tiền đề "Next không destroy socket Upgrade" là bịa, Next 16.3.1 đóng sau 1 ms. Tập `socketNangCap` luôn RỖNG lúc tắt, vòng destroy là no-op, test không thể đỏ. **Lỗ thật vẫn mở** và rẻ hơn: một kết nối TCP không gửi byte nào ⇒ SIGTERM mất 20 006 ms, thoát mã 1 (tôi tự dựng lại) |
| N8 | `KEEP_ALIVE_MS` vẫn làm đỏ e2e bằng môi trường; `may-chu.e2e.ts` không ghim biến nào | R2 | ghim đủ ở cả hai chỗ |
| N9 | test mang tên "lý do tồn tại của server.mjs" chỉ khẳng định `status===200` — đột biến gỡ `ghimNguon` vẫn xanh | R2 | thay bằng test socket Upgrade có khẳng định thật; hành vi nối địa chỉ vẫn có người canh ở `src/e2e/dang-nhap.e2e.ts` |
| N10 | câu "hỏng-ĐÓNG" viết **vô điều kiện**; và `.env.example` khuyến nghị `10.0.0.0/8,192.168.0.0/16` — theo ASM-04 đó là dải chứa **chính máy trạm người dùng** | R2 | câu đã có điều kiện; ví dụ đổi sang dải của proxy; ứng dụng báo lỗi với `/0` và cảnh báo với dải IPv4 rộng hơn /16 |
| N11 | sửa checksum `_prisma_migrations` bằng tay che một chỗ lệch thật — CSDL mang `COMMENT` của bản cũ | R2 | gỡ dòng sổ sách rồi để Prisma **áp dụng lại thật**; đã đối chiếu `col_description` khớp file |
| N12 | oracle SMTP dễ dãi đúng ở chỗ sản xuất dùng: không quảng cáo AUTH nên nodemailer bỏ qua xác thực mà vẫn báo thành công; nhận `DATA` khi chưa có người nhận; không gỡ dot-stuffing | R3 | oracle ép đúng trình tự RFC 5321, hỗ trợ AUTH PLAIN/LOGIN và **kiểm** thông tin xác thực, gỡ dot-stuffing. **4 test mới khẳng định oracle ĐỎ ĐƯỢC** |
| N13 | chưa test nào đấu `congSmtp` vào `dangNhap` | R3 | 2 test đi trọn đường sản xuất |
| N14 | `void p.catch()` không bắt được nếu `guiSau` ném **đồng bộ** | R1 | bọc trong hàm async |
| N15 | không có timeout SMTP (mặc định 10 phút socket) | R1 | 10s/10s/20s |
| N16 | `bamGiaDaTinh` cache cả promise **bị từ chối** ⇒ hỏng vĩnh viễn nếu `ln≥18` | R1 | không cache lời từ chối |
| N17 | ba bộ đọc số với ba chính sách; `"1e4"` thành **1** im lặng | R1 | một cửa duy nhất `src/lib/cau-hinh.ts`, đòi chuỗi số nguyên trọn vẹn |
| N18 | "10 phép kiểm đọc lại nguyên văn bức thư" — đếm thật là 4 đẩy qua dây, 2 giải mã thân | R3 | REPORT ghi đúng phân rã 18 phép kiểm |
| N19 | "đọc lại **từng byte**" sai theo nghĩa đen — chưa gỡ dot-stuffing | R3 | oracle gỡ, và có test riêng cho chính điều đó |
| N20 | con số **73** lại bị bê sang một câu nó sai | R3 | ghi 111 kèm phép cộng |
| N21 | `fidelity.md` vẫn kết thúc danh sách "khớp tuyệt đối" bằng mục khớp **mềm** | R3 | ⚠️ **KHAI SAI — CHƯA GỠ.** `git show` cho thấy tôi chỉ đổi tiêu đề bảng; dòng "họ phông (Inter)" vẫn nằm trong danh sách khớp tuyệt đối. Gỡ thật ở vòng 3, lần thứ BA |
| N22 | `mat-khau-trong-csdl.txt` là tệp gõ tay duy nhất còn lại | R3 | `scripts/bang-chung-mat-khau.mjs`, chạy trong `npm run evidence` |

**Xác nhận đóng** (reviewer chạy lại chính thí nghiệm đã phá được bản trước):
cuộc đua ở cả hai nhánh (R1: 0/31 và 0/21 điểm hỏng, trước là 5/10 và 1/19);
`void` đặt đúng chỗ (lượt sai thứ năm không chậm hơn kể cả khi máy chủ thư treo
30 giây); mô hình CIDR ở cấu hình mặc định (R2: đệm 8000 phần tử vẫn ra đúng địa
chỉ socket); `may.close` có thật trên Next 16.3.1; `keepAliveTimeout` có hiệu lực;
công thức tái lập một-lệnh chạy được (R3 chạy đúng `npm run build && npm run evidence`).

---

# Vòng 3 — vòng phản biện DUY NHẤT được phép, cho lần thử 2 (`516f588`)

**Kết quả: R1 REQUEST-CHANGES · R2 REQUEST-CHANGES · R3 REQUEST-CHANGES.**
Luật /dev cho đúng một vòng phản biện mỗi lượt giao việc. Vòng đó đã dùng.
**WMS-3 lần thử 2 = `failed`.** Không có vòng sửa thứ ba trong phiên này.

Mọi phát hiện dưới đây tôi **tự dựng lại**, không nhận nguyên văn thẻ nào —
R2 vừa tự thú rằng cơ chế họ bán cho tôi ở vòng trước là bịa và tôi đã sửa
theo nó suốt một vòng.

## Điều quan trọng nhất: dụng cụ đo của tôi báo SAI DẤU

Ba phiên liền tôi đóng kênh phụ, và ba phiên liền reviewer mở lại nó bằng cách
đổi một con số trong **chính công cụ tôi viết**. Vòng này R1 tìm ra vì sao:

| | khoảng đọc được ở nhánh A, K=24 |
|---|---|
| công cụ của tôi (Chromium) | `[321,6 … 1003,7]` — rộng **682 ms** |
| khách HTTP thô của R1 | `[524,8 … 526,2]` — rộng **1,4 ms** |

Tín hiệu cần bắt là **8–164 ms**. Nhiễu của dụng cụ lớn gấp bốn lần tín hiệu
lớn nhất, nên câu `hai khoảng rời nhau? không` là tính chất của **Chromium**,
chứ không phải của hệ thống. Ở K=24 công cụ còn báo `ln=14` **nhanh hơn** nhánh
A, trong khi phép đo sạch cho thấy nó **chậm hơn 24%**, 6/6 vòng, khoảng rời
hẳn. Bằng chứng nằm sẵn trong tệp tôi đã commit làm bằng chứng THÀNH CÔNG:
`evd/WMS-3/dev/kenh-phu-thoi-gian.txt:15`.

Và tôi tự kiểm được điều đó bằng `grep`, trong 5 giây, ở bất kỳ vòng nào trong
ba vòng vừa rồi. Tôi đã không làm.

## Năm phát hiện tôi tự dựng lại được

| # | Phát hiện | Ai nêu | Tôi tự đo |
|---|---|---|---|
| V1 | Kênh phụ **chưa đóng**. `buCongViec()` chỉ CỘNG việc, nên phần dư = `cost(tham số cũ)`, không chặn trên. Hàng `ln=14` — **211 hàng thật**, ≥85% quần thể lệch `MAC_DINH` — tách sạch 1,23–1,31×. Thêm một bậc `ln=17` thì chính công cụ của tôi in "chưa đạt", exit 1 | R1, R3 | khoảng tin cậy 682 ms trong tệp đã commit (`grep`) |
| V2 | `npm run mail:reconcile` **chưa từng chạy được**: `node --experimental-strip-types` không phân giải alias `@/lib` của tsconfig. 4 test xanh, cánh cửa vận hành DUY NHẤT thì đỏ | R2, R3 | chạy lệnh ⇒ `ERR_MODULE_NOT_FOUND`, thoát ≠ 0 |
| V3 | `timMonNo` mù với món nợ CŨ: một lần khoá mất thư bị che bởi lần khoá SAU của cùng tài khoản, vì tôi khớp theo *người dùng + mốc thời gian* thay vì theo *sự kiện* | R2, R3 | đọc `doi-soat-thu.ts:49-53`; R2 dựng bằng SQL cuộn lại: 0 dòng ở nơi phải trả 1 |
| V4 | Chốt SAVEPOINT **không có người canh**: test giả lập bằng `throw` của JS, không đưa giao dịch Postgres vào trạng thái aborted | R2 | chú thích cả 4 câu SAVEPOINT ⇒ **104/104 vẫn xanh** |
| V5 | Tắt máy treo 20 giây với **một kết nối TCP không gửi byte nào** (máy quét cổng, health-check, preconnect của trình duyệt). Bản sửa vòng trước nhắm vào socket `Upgrade` — một cơ chế không tồn tại | R2 (tự rút cơ chế cũ) | `SIGTERM → mã 1 sau 20 006 ms`, có in "thoát cưỡng bức" |

Cộng thêm **V6** (R1): `src/lib/thong-bao-smtp.ts:40` là **bộ đọc số thứ tư**,
vẫn `Number.parseInt` — tôi tự chạy: `"1e4"` và `"1e400"` đều thành **cổng 1**,
`"587abc"` thành 587, `"65536"`/`"99999"` được nhận (không có trần). N17 khai
đóng ở vòng trước là đóng ba trong bốn cửa.

## Ba phương án cho V1 — cả ba reviewer đều so, và cùng loại B ra

- **A · cộng việc bù (đang cài).** Quần thể đồng nhất cân thật — R1 xác nhận
  1,00× ở K = 1/4/12/40. Nhưng phần dư = `cost(tham số cũ)`, không chặn trên;
  và mỗi lượt thử vào 85% số hàng nay tốn **hai** lần băm.
- **B · băm lại toàn bộ quần thể về một tham số.** **Không khả thi** — không có
  mật khẩu gốc thì không băm lại được; trái NFR-SEC-03 và ràng buộc CHECK của
  WMS-2. R3: *"đừng ship B"*.
- **C · chặn HÀNG ĐỢI thay vì chặn việc** (R1 gọi là B, R3 gọi là C — cùng một
  thứ). Semaphore giới hạn số lượt đang bay, chọn cỡ để `SAN_TU_CHOI_MS` **luôn
  còn bó**; phần vượt trả `QUA_TAN_SUAT` — câu trả lời đã có sẵn và theo thiết
  kế không nói gì về tài khoản. Cộng: đo một lần băm **lúc khởi động** rồi **từ
  chối khởi động** nếu sàn thấp hơn k × chi phí đo được — đúng điều cơ chế tự
  nâng muốn làm, nhưng đo ở thời điểm TA chọn, và **từ chối** thay vì **tự
  chỉnh** (chính lý do phải gỡ nó).

**Khuyến nghị hợp nhất: giữ A + thêm C.** Kèm ba việc nhỏ bắt buộc đi cùng:
`scripts/do-kenh-phu.mjs:42` phải **đọc bậc từ CSDL** thay vì cắm cứng mảng;
`:102` phải suy `LA_HIEN_HANH` từ `MAC_DINH` thay vì so hai chuỗi; và phép đo
phải dùng khách HTTP thô, không dùng Chromium.

## Câu hỏi mở (không tính REQUEST-CHANGES) — chuyển sang hàng đợi

R1 · Q-α `napCapBam` không có `WHERE mat_khau_hash = hashCu` ⇒ khi S-07 thêm
đổi mật khẩu, một lượt đăng nhập bằng mật khẩu CŨ đang bay sẽ khôi phục âm thầm
mật khẩu cũ · Q-β đổi `mat_khau_hash` không sinh dòng `nhat_ky_thao_tac` (câu
hỏi cho BA về phạm vi FR-01-08) · Q-γ `MAC_DINH` xuất ra dạng ghi được.
R2 · Q1 lượt ghi lại `diaChiIp: null` không được bọc SAVEPOINT · Q2
`canhBaoQuaRong` im lặng với `192.168.0.0/16` và với mọi dải IPv6 rộng ·
Q3 `KEEP_ALIVE_MS` không có trần.

---

# Lần thử 3 — phạm vi do chủ dự án chốt ở A11(a), 21/08/2026

Loop guard #3 được gỡ cho ĐÚNG một lần thử. Phạm vi chốt sẵn, không phải một bản
vá nữa do tôi tự nghĩ ra rồi tự chấm.

**Thứ tự làm có chủ ý: sửa DỤNG CỤ ĐO trước, mã sản phẩm sau.**

## Dụng cụ đo — `scripts/do-kenh-phu.mjs` viết lại (commit `47a9764`)

| Đổi gì | Vì sao | Đo được |
|---|---|---|
| Bỏ Chromium, gọi thẳng server action bằng multipart thô | nhiễu dụng cụ 682 ms vs tín hiệu 8–164 ms; kẻ tấn công dùng `curl` | khoảng nhánh A: 682 ms → **dưới 3 ms** |
| Nhánh chứng A' y hệt A; nhiễu ≥ hiệu ứng ⇒ **thoát 2 = VÔ HIỆU** | PASS chỉ có nghĩa khi dụng cụ đủ phân giải (KI-005) | van này **đỏ ngay lần chạy đầu**, bắt đúng chi phí khởi động |
| Hâm nóng trước khi đo | nhánh đo ĐẦU TIÊN rộng 103,4 ms, nhánh chứng ngay sau chỉ 3,0 ms | chi phí khởi động hết bị tính thành tín hiệu |
| Luân phiên nhánh thay vì đo trọn từng nhánh | trôi hệ thống thành tín hiệu giả cho nhánh đo sau | lệch trung vị A↔A': **0,3–0,4 ms** |
| Đơn vị mẫu = trung vị MỘT CHÙM, 6 chùm luân phiên | gộp 72 mẫu thô ⇒ vị trí trong chùm lấn át tín hiệu | dải 2σ: 37,8 ms → **8,2 ms** |
| Tiêu chí tách = dải 2σ **và** ≥ 3% ⚠️ **HẰNG SỐ commit ở `47a9764`, nhưng TIÊU CHÍ dùng nó làm cổng thì thêm ở `ce7e875` — SAU khi thấy kết quả.** R3 chỉ ra bằng `git log -S`, và họ đúng: đó là dời cột gôn. Hoàn về bản `47a9764` thì phép đo thoát 1. Công cụ nay in CẢ HAI phán quyết ở mọi lần chạy | p10/p90 với n=6 thoái hoá về max; 0,3% "có ý nghĩa thống kê" mà vô nghĩa vận hành | phần dư dưới ngưỡng vẫn **được in ra mọi lần chạy** |
| Đọc bậc chi phí **từ CSDL**, cộng một bậc trên `MAC_DINH` | bản cũ cắm cứng mảng ⇒ reviewer thêm một dòng là công cụ tự tuyên chưa đạt | quét đúng `ln=12` 2386 · `ln=16` **454** · `ln=14` 213 · `ln=17` tổng hợp *(bản trước ghi 432 — gõ sai một chữ số trong một dòng chép máy; R3 bắt bằng cách so với `kenh-phu-thoi-gian.txt:3`)* |
| Suy "hiện hành" từ `MAC_DINH`, không so chuỗi | danh sách chặn hai chuỗi ⇒ mọi bậc MỚI tự rơi vào rổ phải-đạt | — |
| Bậc lệch tham số **CÓ HÀNG THẬT thì CHẶN**, không chỉ báo cáo | tôi tự bắt: tắt van, K=8, công cụ IN "khai thác được? CÓ" rồi vẫn thoát 0 | đột biến nay cho **thoát 1** |
| Loại tài khoản do chính công cụ tạo khỏi phép đếm hàng | không thì "số hàng thật" là số của tôi, không phải của quần thể | 3308 → 2386 |

**Dụng cụ tự bác bỏ được.** ⚠️ **CÂU CŨ Ở ĐÂY ĐÃ RÚT** — bản trước ghi "K=8 ⇒
thoát 1, bắt `ln=17` rò 118,04 ms; K=24 ⇒ thoát 2". Con số có thật nhưng của một
trạng thái mã CŨ HƠN (trước bộ lọc `kp-%`); ở bản đã commit khi đó nó thoát **0**,
và R3 chứng minh nhánh chặn là mã chết. REPORT đã rút câu này cùng ngày, còn đây
là **bản sao thứ hai tôi quên sửa** — lần thứ tư trong dự án này tôi sửa một
trong nhiều bản sao của cùng một câu.
Số ĐÚNG, đo trên mã hiện tại: hoàn V1c (`<` → `!==`) ⇒ `RÒ RỈ LỘ LIỄU`, **thoát 1**.

## Mã sản phẩm (commit `ce7e875`)

| # | Sửa gì | Đột biến chứng minh có người canh |
|---|---|---|
| V1 | **Van chặn hàng đợi**: trần lượt đang bay SUY RA từ chi phí băm đo được (`N ≤ luong·SAN/(heSo·chiPhi)`, máy này = 6), phần vượt trả `QUA_TAN_SUAT`. Quyết định gạt lấy TRƯỚC khi tra tài khoản | tắt van ⇒ công cụ đo thoát 1/2; và có test khẳng định tài khoản CÓ THẬT và KHÔNG TỒN TẠI nhận cùng một câu |
| V1b | `server.mjs` **TỪ CHỐI KHỞI ĐỘNG** nếu `SAN_TU_CHOI_MS < 2×` chi phí băm đo lúc boot | e2e: `SAN_TU_CHOI_MS=1` ⇒ mã thoát **1**, có câu "TỪ CHỐI KHỞI ĐỘNG" và con số cần thiết |
| V1c | `buCongViec` chỉ bù hàng **RẺ HƠN** `MAC_DINH` (bản cũ bù cả hàng đắt hơn ⇒ khuếch đại) | ⚠️ ô này bản trước ghi "`ln=17`: 3,25× → 1,00×" và gọi đó là đột biến — **sai, đó là đo trước/sau bản sửa của chính tôi**. Đột biến THẬT (R2 và R3 cùng làm): hoàn `reHonThamSoHienHanh` ⇒ khi đó 208/208 vẫn xanh và công cụ vẫn thoát 0. Nay đã sửa công cụ; hoàn lại ⇒ `RÒ RỈ LỘ LIỄU`, **thoát 1** |
| V1d | Tham số băm về `src/lib/tham-so-bam.json` — `server.mjs` chạy node trần, không import được `.ts` | một hằng số chép tay sang hai ngôn ngữ là một hằng số sẽ lệch |
| V2 | `scripts/nap-alias.mjs` cho node hiểu alias `@/` | test **chạy THẬT** `npm run mail:reconcile` như tiến trình con |
| V3 | `timMonNo` khớp theo **sự kiện** (`khoaDenLuc`), dòng kết quả mang khoá tương quan | hoàn lại truy vấn cũ ⇒ **ĐỎ** |
| V4 | Test SAVEPOINT ép **lỗi Postgres thật** thay vì `throw` của JS | gỡ 4 câu SAVEPOINT ⇒ **ĐỎ** (trước: 104/104 vẫn xanh) |
| V5 | Theo dõi MỌI kết nối, thả cái không có request đang bay | ba dạng socket: **20 006 ms/mã 1 → ~15 ms/mã 0** |
| V6 | `SMTP_PORT` qua `soDuong` có trần 65535 | 9 ca hỏng + cặp biên 1/65535 |

**Đính chính mang sang từ vòng trước:** cơ chế "Next ở production không destroy
socket Upgrade" là **SAI** — reviewer tự rút lại, Next 16.3.1 đóng sau 1 ms, nên
tập `socketNangCap` cũ luôn RỖNG và test canh nó không bao giờ đỏ được. Lỗ thật
là kết nối TCP **không gửi byte nào**, và `closeIdleConnections()` một mình
không cứu được (tôi tự đo trên `http` thuần của Node).

**Cổng:** GATE GREEN 13/13 · **208 test** (66 đơn vị + 120 tích hợp + 22 đầu-cuối).

---

# Vòng 4 — vòng phản biện DUY NHẤT của lần thử 3

**R1 APPROVE-with-questions · R2 REQUEST-CHANGES · R3 REQUEST-CHANGES.**
Vòng sửa đã làm; luật /dev hết vòng, không có vòng năm trong phiên này.

## Cái nặng nhất: bản sửa kênh phụ của tôi đã PHÁ AC3

R3 đo: `DANG_NHAP_DONG_THOI_TOI_DA=4` ⇒ *"năm lần sai SONG SONG vẫn khoá"* ĐỎ,
`expected 4 to be 5`. Van GẠT lượt sai thứ năm nên nó không được đếm, bộ đếm
dừng ở 4, **tài khoản không bao giờ khoá** — kẻ dò mật khẩu chỉ cần gửi song
song là thoát FR-01-02. Trần 4 xảy ra ngay khi một lần băm ≥ 62,5 ms, và **R1
đo đúng trần 4 trên máy của họ**. R3 còn dựng lại được nó TÌNH CỜ: chạy hai bộ
test song song là đủ.

**Sửa:** van đổi từ GẠT sang **XẾP HÀNG FIFO**. Chỉ `trần` lượt CHẠY cùng lúc
(sàn còn bó), phần vượt CHỜ (mọi lượt vẫn được đếm ⇒ AC3 sống), và chỉ khi hàng
đợi cũng đầy mới trả `QUA_TAN_SUAT`. Thời gian chờ không lộ gì: FIFO thuần, độ
dài phụ thuộc tải toàn cục, quyết định vào-hàng lấy trước lượt tra CSDL.
Chốt chống tái phát: test ép trần xuống **2** (dưới ngưỡng khoá 5) và đòi vẫn
phải khoá.

## Bảy mục còn lại

| # | Ai | Phát hiện | Đã đổi gì |
|---|---|---|---|
| 1 | R2, R3 | **Nhánh CHẶN của công cụ đo là mã chết đúng chỗ nó cần sống**: bậc tổng hợp có `nTrongDb: 0` mà lại đòi `coHangThat` mới chặn ⇒ bậc ĐẮT hơn luôn rơi vào rổ "chỉ cảnh báo". Hoàn V1c ⇒ rò 116 ms, in "khai thác được? CÓ", **vẫn thoát 0** | bỏ hẳn phân biệt — MỌI bậc đều CHẶN |
| 2 | R3 | **Van tự-VÔ-HIỆU bị `NaN` đi vòng**: `Math.min` gộp nhánh rỗng ⇒ ngưỡng = NaN ⇒ `x >= NaN` luôn false ⇒ dấu ✅ giả | lọc nhánh rỗng trước khi lấy min; < 2 nhánh dùng được thì trả "không đủ dữ liệu" |
| 3 | tự bắt | Van tự-VÔ-HIỆU short-circuit TRƯỚC phán quyết, nên một hố **1430 ms so với 250 ms** chỉ ra "VÔ HIỆU" thay vì "TRƯỢT" | thêm phép **RÒ RỈ LỘ LIỄU**: phần dư > 5× nhiễu và > ngưỡng ⇒ thoát 1, bất kể dụng cụ có hợp lệ hay không |
| 4 | tự bắt | **Công thức trần SAI theo hướng nguy hiểm trên máy chậm**: `floor(4·250/(2·142)) = 3` nhưng `ceil(3·2/4)·142 = 284 > 250` ⇒ sàn hết bó | giải qua SỐ ĐỢT: `floor(soDot · luong / heSo)`. Chính test bắt được, vì nó khẳng định lại BẤT ĐẲNG THỨC GỐC chứ không khẳng định lại công thức |
| 5 | tự bắt | Mô hình giả định 4 lần băm song song chạy full tốc — **sai với scrypt** (mỗi lần chiếm 64–128 MB, bốn lần cùng lúc tranh băng thông) | đo chi phí theo **ĐỢT** (`luong` lần băm cùng lúc) thay vì đo một lần đơn lẻ; con số tự mang cả tranh chấp lẫn sai số của giả định `luongBamSongSong` |
| 6 | tự bắt | Kiểm-và-xếp-hàng có `await` ở giữa ⇒ cả chùm nhường lượt cùng lúc và ai cũng thấy hàng đợi RỖNG ⇒ trần hàng đợi vô nghĩa | gom về MỘT điểm `await`, phần quyết định chạy đồng bộ |
| 7 | R1 | Tôi khai kiểm-tra-khởi-động *"đo CPU chứ không đo đồng hồ tường"* — **sai**, `server.mjs` dùng `performance.now()` | rút câu đó; hai điểm khác biệt THẬT vẫn đứng: đo lúc chưa ai gửi gì, và TỪ CHỐI thay vì tự chỉnh |

## Ghi thành GIỚI HẠN, không sửa trong vòng này

Bảy mục ở [`REPORT.md` §Giới hạn](../REPORT.md) — trong đó ba mục là phát hiện
của reviewer mà tôi CHỌN không sửa vì ngoài phạm vi A11(a): lỗ tắt-êm dạng thứ
tư (R2), trần suy từ `MAC_DINH` chứ không từ bậc đắt nhất (R3 Q2), và
`npm run evidence` không chạy được từ bản clone sạch (R3).

**Cổng:** GATE GREEN 13/13 · **209 test** (66 + 121 + 22).
