# WMS-3 — Đăng nhập và khoá tạm sau 5 lần sai

Ticket WMS-3 · màn hình SC-01 · đường `/login`
· hồ sơ review: [dev/review.md](dev/review.md)
· bằng chứng giao diện: [dev/manifest.md](dev/manifest.md)
· độ trùng khớp: [dev/fidelity.md](dev/fidelity.md)

> ## ⛔ WMS-3 CHƯA ĐẠT — đừng đọc tài liệu này như một báo cáo hoàn thành
>
> **Lần thử 2 bị chặn ngày 20/08/2026: R1, R2, R3 đều REQUEST-CHANGES.** Luật
> /dev cho đúng MỘT vòng phản biện mỗi lượt giao việc và vòng đó đã dùng hết.
> Đây là lần `failed` **thứ hai**, nên WMS-3 bị khoá khỏi vòng tự chọn việc cho
> tới khi chủ dự án gỡ (ô hành động ở `docs/pm/decisions.md`).
>
> Sáu khiếm khuyết còn nguyên, tôi **tự dựng lại được cả sáu** — chi tiết và
> phép đo ở [dev/review.md §Vòng 3](dev/review.md):
>
> | | Còn hỏng | Hệ quả |
> |---|---|---|
> | V1 | Kênh phụ thời gian **chưa đóng** với hàng lệch tham số băm (`ln=14`: 211 hàng thật, 1,23–1,31×, khoảng rời hẳn) | ràng buộc cuối SC-01 và quyết định G-01 **chưa đạt** |
> | V2 | `npm run mail:reconcile` **chưa từng chạy được** (`ERR_MODULE_NOT_FOUND`) | cửa vận hành duy nhất để cứu thư mất là cửa chết |
> | V3 | `timMonNo` bỏ sót món nợ cũ bị lần khoá sau che mất | thư mất vẫn mất, kể cả khi có người chạy đối soát |
> | V4 | Chốt SAVEPOINT **không có người canh** (gỡ cả 4 câu ⇒ 104/104 vẫn xanh) | lớp phòng thủ thứ hai của N1 có thể mục đi mà không ai biết |
> | V5 | Một kết nối TCP không gửi byte nào ⇒ SIGTERM treo **20 006 ms**, thoát mã 1 | mỗi lần triển khai cuốn chiếu mất 20 giây, unit systemd vào trạng thái failed |
> | V6 | `thong-bao-smtp.ts:40` là bộ đọc số **thứ tư**: `SMTP_PORT="1e4"` ⇒ **cổng 1**, im lặng | AC4 chết câm nếu gõ nhầm dạng số |
>
> **AC4 vẫn chưa đạt ở sản xuất** vì lý do độc lập: chưa có thông số SMTP thật
> (Q7 phần 2 — cần IT). Bộ nối đã dựng và có test, nhưng chưa nối vào gì cả.
>
> Cổng gate vẫn **GREEN 13/13** và **188 test xanh** trong khi sáu điều trên
> đúng như mô tả. Đó là nội dung chính của báo cáo này, không phải chú thích.

**Lần thử 2.** Lần thử 1 bị ba reviewer chặn ở hai vòng với bảy lỗi thật. Báo cáo
này viết lại từ đầu; lịch sử từng phát hiện nằm trong hồ sơ review.

## Nói trước điều bất lợi

### 1. Bảy lỗi lọt qua 111 test xanh và cổng gate 13/13 ở lần thử 1

(111 = 34 đơn vị + 73 tích hợp + 4 đầu-cuối. Bản trước của dòng này viết "73" —
con số đúng của riêng bộ tích hợp, bị bê sang một tổng nó không phải. Reviewer
bắt được hai lần liên tiếp, nên lần này ghi cả phép cộng.)

Không bước nào của cổng gửi hai yêu cầu **cùng lúc**, cầm **đồng hồ**, gửi **dữ
liệu rác**, hay chạy ở **cấu hình sai**. Bốn góc mù đó không ngẫu nhiên: tôi viết
bộ test, nên nó chỉ phủ những gì tôi đã nghĩ tới. Đã ghi thành KI-004.

Hai lỗi nặng nhất, để lại đây vì chúng nói lên nhiều hơn một dòng changelog:

- **Khoá tài khoản bị vô hiệu hoá bằng cách gửi song song.** Năm lượt sai đồng
  thời cùng đọc `0` và cùng ghi `1` ⇒ không khoá, mật khẩu đúng vẫn vào được.
  Gửi đồng thời là hành vi mặc định của mọi bộ dò mật khẩu.
- **Tôi khai một tiền đề chưa kiểm, hai lần liên tiếp.** Lần một: "Next.js server
  action không đọc được địa chỉ socket" — sai, chép vào 5 chỗ. Sửa xong tôi lặp
  lại đúng khuôn: "khai thừa số chặng proxy thì trả không biết" — cũng sai, chép
  vào 6 chỗ, kèm hai test chọn đầu vào theo điều mình mong. Cả hai đều do
  reviewer bác bằng phép chạy.

### 2. AC8 chỉ đúng trong MỘT tiến trình

Bộ đếm tần suất nằm trong bộ nhớ tiến trình. SRS §2.3 chạy nhiều bản sao sau load
balancer ⇒ ngưỡng thực tế là R × ngưỡng. Cùng món nợ: cửa sổ đếm là cửa sổ **cố
định**, nên hai cửa sổ liền kề cho phép 2× ngưỡng trong khoảnh khắc giao nhau.
Cả hai chỉ mất khi có kho đếm dùng chung — phụ thuộc **OPN-03**, chưa quyết.

### 3. Thư gửi được, nhưng chưa có nơi để gửi

Chủ dự án chọn **SMTP nội bộ** (Q7, 20/08) ⇒ AC4 hết bị chặn. Nhưng **thông số
kết nối thì chưa có** — cần xin IT. Để trống thì sự kiện khoá vẫn vào sổ kiểm
toán với `thongBaoEmail: 'KHONG_CO_HA_TANG'`, ứng dụng ghi cảnh báo lúc khởi
động, và không thư nào rời máy.

Nói chính xác bằng chứng có gì, vì bản trước nói quá ở đúng chỗ này:

- **21 phép kiểm** chạm đường thư: **18** trong `thong-bao-smtp.itest.ts` +
  **3** trong `dang-nhap.itest.ts`. Con số này đọc từ đầu ra của
  `npm run test:integration`, không đếm tay.
- Bản trước ghi "18 phép kiểm" kèm một phân rã năm ô (6 qua dây · 2 giải mã ·
  4 oracle · 4 đối soát · 2 cấu hình). **Cả tổng lẫn phân rã đều sai** — R3 bắt
  hai ô, và khi đếm lại tôi thấy tổng cũng sai. Tôi bỏ hẳn lối ghi phân rã gõ
  tay: mọi lần tôi viết một bảng phân rã tự tính, nó sai. Số nào không đọc được
  từ đầu ra của một lệnh thì không vào hồ sơ nữa.
- Bản trước viết "10 phép kiểm **đọc lại nguyên văn bức thư**" — sai theo cả số
  lẫn chữ. Và "đọc lại **từng byte**" khi đó cũng sai theo nghĩa đen: máy chủ giả
  chưa gỡ dot-stuffing nên thứ đọc được là dạng **trên dây**. Nay nó gỡ, và có
  một test riêng khẳng định đúng điều đó.
- **Chưa có** bằng chứng nào về STARTTLS/TLS-ngay: máy chủ giả không quảng cáo
  STARTTLS, nên nhánh `SMTP_TLS_NGAY` chưa từng chạy. Ghi thành nợ.

### 4. Kênh phụ thời gian: đạt ở quần thể đồng nhất, còn phần dư ở quần thể lệch

Ba lần trước tôi đi tìm **một hằng số đúng** cho chuỗi băm giả — cắm cứng
`ln=16`, rồi `MAC_DINH` (chính là `ln=16`), rồi tham số phổ biến nhất, rồi tham
số đắt nhất. Cả bốn đều sai, vì tín hiệu đến từ chênh lệch **công việc**, không
từ giá trị hằng số. Bản này cân công việc: hàng dùng tham số cũ được bù thêm một
lần băm ở tham số hiện hành.

Phép đo cũng đổi: nó **quét ba bậc chi phí** thay vì ghim một bậc, và tách phán
quyết làm hai — quần thể đồng nhất (điều kiện phải đạt) và quần thể lệch (phần
dư được báo cáo). Lý do đổi: reviewer chỉ cần đổi đúng một con số trong bản trước
là nó tự tuyên "chưa đạt". Một công cụ mà tác giả chọn được điểm đo thì nó đo
năng lực chọn điểm.

## Việc đã làm

| Tệp | Trách nhiệm |
|---|---|
| `src/lib/mat-khau.ts` | Băm scrypt PHC; `doiChieu` dùng `timingSafeEqual`, trả `false` chứ không ném khi chuỗi băm hỏng |
| `src/lib/khoa-tam.ts` | Cửa sổ 15 phút / ngưỡng 5 / khoá 30 phút — thuần, đồng hồ là tham số |
| `src/lib/dia-chi-ip.ts` | Danh sách CIDR proxy tin cậy; đi từ **phải** sang, từ chối mọi giá trị không phải IP |
| `server.mjs` | Máy chủ sản xuất; nối địa chỉ socket vào cuối `x-forwarded-for`; thoát ≠0 khi khởi động hỏng; tắt êm khi SIGTERM |
| `src/lib/thong-bao.ts` | Cổng `CongThongBao`: `khoaTaiKhoan` (trong giao dịch) + `guiSau` (sau commit) |
| `src/lib/thong-bao-smtp.ts` | Bộ nối SMTP thật, ghi kết quả gửi thành một dòng sổ MỚI |
| `src/lib/phien.ts` | Phiên hết hạn theo **thao tác cuối**, gộp ghi mỗi 60 giây (ADR-0002) |
| `src/lib/gioi-han-tan-suat.ts` | Đếm theo IP, hoặc theo định danh khi không biết IP; dọn khi bảng phình |
| `src/lib/dang-nhap.ts` | Ghép luồng; **cả hai** nhánh sai và đúng đều nguyên tử; sàn thời gian là hằng số cấu hình |
| `src/app/login/` | Trang SC-01, biểu mẫu, server action đặt cookie |
| `src/e2e/` | 18 test đầu-cuối (2 tệp): luồng đăng nhập + hành vi sản xuất của `server.mjs` |
| `scripts/chup-bang-chung.mjs` | Dựng lại **toàn bộ** bằng chứng bằng một lệnh |

Hai chi tiết cố ý, dễ bị đọc nhầm là thừa:

- **Lượt gửi thư KHÔNG nằm trong đường phản hồi.** Chỉ lần sai thứ năm mới gửi
  thư; chờ gửi xong mới trả lời thì đúng lượt đó chậm hơn — một chữ `await` đặt
  sai chỗ vô hiệu cả sàn thời gian lẫn quyết định G-01. Có test riêng cho việc này.
- **Luật đếm không chép sang SQL.** Giao dịch dùng `SELECT … FOR UPDATE` rồi gọi
  đúng hàm thuần — hai bản của một luật là hai bản sẽ lệch.

## Đo được, không phải khai

| Hạng mục | Số | Nguồn |
|---|---|---|
| Test WMS-3 (51 đơn vị + 50 tích hợp + 18 đầu-cuối) | **119** | `npm test` · `test:integration` · `test:e2e` |
| Toàn bộ bộ test | **188** (66 + 104 + 18) | như trên |
| Kênh phụ, gửi **tuần tự**, quét 3 bậc chi phí | **1,01×** | `dev/kenh-phu-thoi-gian.txt` |
| Kênh phụ, gửi **đồng thời** 24 lượt, quần thể đồng nhất | **1,04×**, khoảng chồng lấn | như trên |
| Kênh phụ, gửi **đồng thời**, quần thể LỆCH tham số | **1,05×** — phần dư, được báo cáo chứ không giấu | như trên |
| Tiêu chí trùng khớp thiết kế | **13/14** | `dev/fidelity.json` |
| Thuộc tính CSS khớp bản mẫu | **59/60** = 58 tuyệt đối + 1 mềm | `dev/fidelity.json` |
| Hàng `nguoi_dung` ngoài danh sách thuật toán cho phép | **0** (bất biến; mẫu số trôi mỗi lượt gate) | `dev/mat-khau-trong-csdl.txt` |
| Cổng gate | **GREEN** (13 bước, 0 bỏ qua) | `python3 .vteam/scripts/gate.py e2e` |

## Chín tiêu chí chấp nhận

| # | Tiêu chí | Kết luận |
|---|---|---|
| AC1 | tên đăng nhập đúng ⇒ có phiên | ✅ |
| AC2 | email nội bộ đúng ⇒ có phiên | ✅ |
| AC3 | sai lần 5 trong 15 phút ⇒ khoá 30 phút | ✅ kể cả khi **năm lượt gửi song song**, và 20 lượt song song vẫn dừng đúng ngưỡng |
| AC4 | thông báo gửi tới email | ✅ **cơ chế đạt** — thư đi qua SMTP thật, thân thư đối chiếu được sau khi gỡ dot-stuffing; oracle chứng minh được là ĐỎ ĐƯỢC khi thông số sai. ⚠️ chưa có thông số SMTP thật, và nhánh TLS chưa kiểm |
| AC5 | lần sai thứ 5 sau mốc 15 phút ⇒ không khoá | ✅ |
| AC6 | hết 30 phút ⇒ vào lại được | ✅ cặp biên `hạn − 1ms` / `hạn` |
| AC7 | thông báo không lộ tài khoản có tồn tại hay không | ✅ ở quần thể đồng nhất (trạng thái của sản xuất), đo cả tuần tự lẫn 24 lượt đồng thời, quét 3 bậc chi phí. Phần dư ở quần thể lệch tham số: 1,05×, khoảng chồng lấn |
| AC8 | vượt ngưỡng ⇒ giới hạn tần suất | ⚠️ đúng trong một tiến trình — xem §2 |
| AC9 | kho dữ liệu chỉ chứa giá trị băm | ✅ 0 hàng ngoài danh sách, CSDL từ chối mật khẩu thô |

## Nợ để lại

1. **Q7 phần 2** — thông số SMTP nội bộ (host/port/tài khoản). Chủ dự án xin IT.
2. **OPN-03** — kho đếm tần suất dùng chung. Chặn AC8 ở nhiều bản sao, và chặn cả
   việc vá cửa sổ đếm cố định.
3. **FR-01-08 chưa cài** — ghi nhật ký *mọi* lần đăng nhập thành công và thất bại
   thuộc S-07. Hôm nay chỉ sự kiện khoá và kết quả gửi thư được ghi.
4. **Đăng nhập phân biệt hoa/thường** — sửa đúng thì phải đổi chỉ mục duy nhất
   sang dạng hàm; chạm SC-20.
5. **Cột `nguon_ip`** mà R3 đề xuất — hoãn sang S-07, lý do ở `dev/review.md`.
6. **Ô chọn kho và ghi chú TOTP** trong bản mẫu SC-01 thuộc WMS-4 và S-06.
