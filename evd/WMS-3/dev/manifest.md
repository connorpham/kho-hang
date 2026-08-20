# WMS-3 · S-01 — bằng chứng giao diện

Màn hình SC-01 · đường `/login`. Mọi ảnh chụp trên bản **build sản xuất**
(`next build` + `next start`), đánh vào **CSDL thật** (PostgreSQL 17 trong
container), qua Chromium 151 ở khung 1440×900, tỉ lệ 1×.
Kịch bản sinh ảnh: `scripts/chup-trang-thai.mjs` · số đo: `scripts/do-trung-khop.mjs`.
Không ảnh nào dựng bằng dữ liệu giả trong trình duyệt.

STATE: empty (01) · error (02, 04) · loading (03) · data (05 — kết quả sau khi
đăng nhập thành công; bản thân biểu mẫu đăng nhập không có "trạng thái có dữ
liệu", nên trạng thái này được chụp ở phía bên kia của luồng)

| Tiêu chí | Ảnh / bằng chứng |
|---|---|
| Bản mẫu gốc để đối chiếu (oracle G-04) | `00_ban_mau_SC-01.png` |
| AC1 · đúng tên đăng nhập ⇒ có phiên | test tích hợp `dang-nhap.itest.ts` — "đúng TÊN ĐĂNG NHẬP + mật khẩu đúng" |
| AC2 · đúng email nội bộ ⇒ có phiên | `05_sau_khi_dang_nhap_thanh_cong.png` (đăng nhập bằng email) + `trang-thai.txt` dòng 05 |
| AC3 · sai lần thứ 5 trong 15 phút ⇒ khoá 30 phút | `04_tai_khoan_dang_bi_khoa.png` + `trang-thai.txt` dòng 04 |
| AC4 · thông báo gửi tới email khi bị khoá | `thong-bao-smtp.itest.ts` (18) + `dang-nhap.itest.ts` (3) — thư đi qua máy chủ SMTP thật dựng trong tiến trình. **AC4 CHƯA ĐẠT ở sản xuất**: chưa có thông số SMTP thật (Q7 phần 2) |
| AC5 · lần sai thứ 5 sau mốc 15 phút ⇒ KHÔNG khoá | test tích hợp — "lần thứ năm SAU cửa sổ 15 phút" |
| AC6 · hết 30 phút ⇒ đăng nhập lại được | test tích hợp — "hết 30 phút… cặp biên" |
| AC7 · thông báo không lộ tài khoản có tồn tại hay không | `02_tu_choi_sai_mat_khau.png` + `04_…png` — cùng câu chữ **và** cùng thời gian |
| AC8 · vượt ngưỡng ⇒ giới hạn tần suất | test tích hợp — hai test NFR-SEC-06 |
| AC9 · kho dữ liệu chỉ chứa giá trị băm | `mat-khau-trong-csdl.txt` (truy vấn SQL trực tiếp) |
| Trạng thái rỗng (mới mở trang) | `01_man_dang_nhap_trang_thai_rong.png` |
| Trạng thái đang xử lý (nút vô hiệu hoá) | `03_dang_xu_ly.png` |
| AC7 · thời gian đáp không phân biệt được bốn lý do | `kenh-phu-thoi-gian.txt` — đo qua HTTP, **cả tuần tự lẫn 24 lượt đồng thời** |
| Độ trùng khớp với bản mẫu | `design_vs_app.png` + `fidelity.md` + `fidelity.json` |

**Ảnh PNG không nằm trong repo** — `.gitignore` giữ bằng chứng dạng chữ và bỏ
nhị phân, đó là luật có sẵn của dự án. Người review trên máy khác dựng lại toàn
bộ bằng **một** lệnh:

```
npm run build && npm run evidence
```

Lệnh đó tự xin một cổng trống, dựng `server.mjs`, chụp mọi trạng thái, đo độ
trùng khớp, ghép `design_vs_app.png`, rồi tắt máy chủ. Công thức cũ liệt kê ba
lệnh cần một `<cổng>` mà không lệnh nào in ra, và `design_vs_app.png` thì không
do lệnh nào sinh ra — reviewer R3 thử làm theo và không chạy được.

Đây cũng là lý do phép đo độ trùng khớp được viết ra **số** trong `fidelity.json`
chứ không phải một tỉ lệ pixel: con số đọc được mà không cần nhìn ảnh.
