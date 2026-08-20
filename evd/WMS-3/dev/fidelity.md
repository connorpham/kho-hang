# WMS-3 · độ trùng khớp với bản mẫu thiết kế

Bản mẫu: `docs/StockFlow-WMS-20-screens.html`, màn hình SC-01 — oracle được chủ
dự án công nhận ở G-04.
Cách đo: `scripts/do-trung-khop.mjs` mở **cả hai** trang trong cùng một Chromium
151, cùng khung 1440×900, rồi so `getComputedStyle` trên từng cặp phần tử tương
ứng. Số thô: `fidelity.json`. Ảnh cạnh nhau: `design_vs_app.png`.

Không dùng so-sánh-pixel, và đây là lý do: hai trang **cố ý** khác nội dung (ô
chọn kho và ghi chú TOTP nằm ngoài phạm vi WMS-3), nên một tỉ lệ pixel lệch sẽ
trộn "lệch vì thiếu phần ngoài phạm vi" với "lệch vì làm sai" thành một con số
duy nhất không đọc được. So từng thuộc tính thì mỗi sai lệch chỉ đúng vào một dòng.

## Kết quả đo

| | Số |
|---|---|
| Tiêu chí khớp (12 tuyệt đối + 1 mềm) | **13 / 14** |
| Thuộc tính khớp | **59 / 60** |
| Lỗi JavaScript trên trang khi đo | 0 |

Phân rã đúng của 60 thuộc tính: **58 khớp tuyệt đối + 1 khớp mềm + 1 lệch**.
(Bản trước viết "59 tuyệt đối + 1 mềm", cộng lại thành 60 khớp và tự mâu thuẫn
với bảng ngay phía trên — reviewer bắt được.)

- *Khớp mềm*: họ phông. Bản mẫu khai `Inter, ui-sans-serif, …`; Next chèn thêm
  một mặt dự phòng nên app khai `Inter, "Inter Fallback", ui-sans-serif, …`.
  Phép đo so **họ đầu tiên** (`scripts/do-trung-khop.mjs`, cờ `mem: true`).

Khớp tuyệt đối, không sai một đơn vị nào: nhãn nhỏ (11px · 0.18em ·
uppercase · `#71717a`), h1 (44px · line-height 1.05 · letter-spacing −0.025em),
mô tả hero (19px · max-width 30ch · `#3f3f46`), dải số liệu (gap 40px),
cột biểu mẫu (nền `#fafafa` · viền trái 1px `#e4e4e7` · đệm 56px/64px),
bề rộng khối 380px, nhãn màn hình, h2 22px, nhãn ô nhập (12px · 500 · `#52525b`),
ô nhập (cao 38px · bo 6px · viền `#e4e4e7` · 13px), nút chính (cao 38px · nền
`#18181b` · chữ `#fafafa`), ghi chú chân (12px · line-height 1.6 · margin-top 34px).

(Họ phông **không** nằm trong danh sách này — nó là khớp MỀM, xem đoạn trên.
Đây là lần thứ BA cùng một mục bị bắt ở cùng một chỗ: hai lần trước tôi khai đã
gỡ nhưng chỉ đổi tiêu đề bảng, không đụng vào dòng này.)

## Sai lệch

### DEVIATION: INTENTIONAL — cỡ chữ gốc trên `body` (16px ở mẫu vs 14px ở app)
Đây là sai lệch DUY NHẤT mà máy đo bắt được.
Bản mẫu để `body` ở mặc định trình duyệt (16px) rồi đặt `font-size: 14px` trên
một div bọc toàn trang; app đặt đúng 14px đó lên `body`. Mọi nội dung thật ở cả
hai bên đều kế thừa 14px — 59 thuộc tính còn lại khớp đã chứng minh điều đó.
Div bọc trong bản mẫu là hệ quả của việc nó là một trang gói sẵn có vỏ giả; chép
nguyên cái vỏ ấy vào ứng dụng thật là bắt chước một tai nạn cấu trúc.

### DEVIATION: INTENTIONAL — thiếu ô "Kho làm việc trong phiên"
Bản mẫu SC-01 có ô chọn kho. Nó là **S-02 · chọn kho làm việc (WMS-4)**, không
nằm trong WMS-3. Dựng sẵn một ô chọn chưa có gì phía sau là hứa một chức năng
không tồn tại. Sẽ vào đúng vị trí này khi WMS-4 chạy.

### DEVIATION: INTENTIONAL — thiếu dòng ghi chú TOTP
Bản mẫu có câu "Vai trò Quản trị hệ thống và Quản lý kho sẽ được yêu cầu mã TOTP
ở bước tiếp theo." Xác thực hai yếu tố là **S-06**, đã hoãn ở quyết định G-02.
Câu đó nói với người dùng về một bước sẽ không xảy ra.

### DEVIATION: INTENTIONAL — "Quên mật khẩu" là chữ, không phải liên kết
Bản mẫu dựng `<a href="#">`. Màn hình khôi phục mật khẩu (SC-05) không nằm trong
Giai đoạn 1. Một liên kết bấm vào không đi đâu tệ hơn một dòng chữ trung thực.

### Không phải sai lệch — nội dung mẫu trong ô nhập
Bản mẫu hiển thị sẵn `thuykho.hn01` và một chuỗi chấm trong ô mật khẩu; đó là dữ
liệu minh hoạ của bản vẽ, không phải yêu cầu. Ảnh `01_…` chụp trạng thái rỗng thật.

## AC4 — thông báo qua email

Không còn thuộc phần "sai lệch". Chủ dự án chọn SMTP nội bộ ở Q7 (20/08), bộ nối
đã dựng và có 21 phép kiểm chạm đường thư (18 trong `thong-bao-smtp.itest.ts`
+ 3 trong `dang-nhap.itest.ts`, đọc từ đầu ra `npm run test:integration`).
Câu "10 phép kiểm đọc lại nguyên văn" ở bản trước là SAI và đã rút ở REPORT —
nhưng nó vẫn nằm nguyên ở ĐÂY và ở `manifest.md` cho tới hôm nay, vì tôi chỉ
sửa một trong ba bản sao. Thông số kết nối thật vẫn chờ IT — xem `REPORT.md` §3.
