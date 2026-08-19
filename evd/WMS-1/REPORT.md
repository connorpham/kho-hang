# WMS-1 — Chi phí lượt đọc phiên (điều kiện chốt ADR-0002)

> # ⚠️ PHÁN QUYẾT ĐANG BỊ TRANH CÃI — vòng review 2, 2026-08-19
>
> Reviewer R1 chỉ ra: điều kiện của ADR-0002 nói *"mỗi request cộng thêm một lượt
> đi CSDL"*, mà **việc lấy kết nối là một phần của lượt đi đó**. Báo cáo này loại
> chờ pool ra khỏi phán quyết — và chính việc loại đó giữ phán quyết ở ĐẠT.
> R1 đo được **riêng chờ pool p95 vượt trần 50 ms ở 2/6 lần chạy** (160 ms, 57 ms).
>
> Đọc theo cách gồm chi phí lấy kết nối → **2/6 lần chạy TRƯỢT**.
> Đọc theo cách loại nó ra → phán quyết dưới đây đứng.
>
> Chọn cách đọc nào là quyết định kiến trúc, không phải việc của phép đo.
> Đã chuyển sang `docs/pm/decisions.md §2` chờ chủ dự án.
> Toàn bộ: [`dev/review.md`](dev/review.md).

> **File này do máy sinh** từ `evd/WMS-1/do-p95.json` bằng
> `scripts/sinh-bao-cao-wms1.py`. Không con số nào được chép tay — vòng review 1
> bắt đúng lỗi đó. Sửa báo cáo = chạy lại phép đo.
> Lần viết **2** · đo lúc `2026-08-19T10:09:37.673Z`

## Phán quyết

**ADR-0002 ĐẠT điều kiện của chính nó.**
p95 của lượt truy vấn, lấy lần xấu nhất trong 5 lần lặp × 2 hồ sơ
dữ liệu: **2.271 ms**, so với ngưỡng 50 ms
(10% của ngân sách 500 ms, NFR-PER-02).
Tức lượt đọc phiên chiếm **0.45%** ngân sách.

Đây là phán quyết **duy nhất** phép đo này có tư cách đưa ra.

## Số đo

Môi trường: PostgreSQL 17.10 on aarch64-unknown-linux-musl · `shared_buffers` 128MB · localhost/stockflow_wms ·
pool 20 kết nối · 200 người đồng thời · 5 lần lặp mỗi hồ sơ.

### Hồ sơ `sach` — 200 dòng, 0.1 MB

| Lần | Nền p95 (ms) | Truy vấn khi tải p95 (ms) | Chờ pool p95 (ms) |
|---|---|---|---|
| 1 | 0.261 | 1.926 | 11.823 |
| 2 | 0.314 | 2.200 | 13.889 |
| 3 | 0.246 | 1.651 | 12.309 |
| 4 | 0.232 | 1.766 | 10.730 |
| 5 | 0.212 | 2.271 | 12.417 |

### Hồ sơ `rac_2_trieu` — 2,000,200 dòng, 506.3 MB

| Lần | Nền p95 (ms) | Truy vấn khi tải p95 (ms) | Chờ pool p95 (ms) |
|---|---|---|---|
| 1 | 0.314 | 2.121 | 13.902 |
| 2 | 0.269 | 1.893 | 11.219 |
| 3 | 0.255 | 1.791 | 10.936 |
| 4 | 0.252 | 1.602 | 10.359 |
| 5 | 0.273 | 1.410 | 10.277 |

## Ba điều số liệu nói mà lần viết trước nói ngược

**1. Rác trong bảng phiên gần như không ảnh hưởng.** Bảng phình từ
0.1 MB lên 506.3 MB
(2,000,200 dòng, vượt xa `shared_buffers` 128MB) mà p95 truy vấn
xấu nhất còn *nhích xuống*: 2.271 → 2.121 ms.
Lần viết trước bày 50.000 dòng rác ra như một sức ép; số liệu nói nó không phải.
Việc dọn phiên hết hạn vì thế là chuyện dung lượng đĩa, **không phải** chuyện tốc độ.

**2. Thành phần lớn nhất không phải CSDL mà là hàng đợi pool.**
Chờ pool p95 xấu nhất **13.902 ms**, gấp
6.1 lần chi phí truy vấn. Nó **không**
nằm trong phán quyết trên vì nó là hệ quả của kích thước pool (20 — một giả
định chưa chốt, xem ADR-0002 C-3), không phải chi phí CSDL. Nhưng nó là phần mà
người dùng thật sẽ cảm thấy, nên WMS-2 phải chốt con số pool một cách tường minh.

**3. Suy giảm của thành phần khi 200 người đồng thời:
624.5%** (nền 0.314 ms →
2.271 ms) — vượt mốc cảnh báo 20%.
**Đây là số liệu, không phải phán quyết NFR-PER-05.** NFR-PER-05 là tiêu chí ở mức màn hình (thời gian phản hồi đầu cuối). Phép đo này đo một thành phần nên KHÔNG kết luận đạt/trượt NFR-PER-05. Con số suy giảm ở đây là cảnh báo mang sang WMS-2.

## Giới hạn — những gì con số này KHÔNG chứng minh

1. **Không có độ trễ mạng.** CSDL cùng máy với tiến trình đo.
2. **Không đo qua Prisma.** ADR-0001 chọn Prisma 7 + `@prisma/adapter-pg`; chi phí
   lớp ORM chưa nằm trong con số này.
3. **Chỉ đo lượt ĐỌC.** Việc ghi `thao_tac_cuoi_luc` (gộp 60 giây theo ADR-0002)
   và nhánh xoá phiên hết hạn khi gặp lúc đọc đều chưa đo.
4. **Máy lập trình, không phải máy chạy thật** — hạ tầng thật còn chờ OPN-03.
5. **`shared_buffers` 128MB là mặc định**, chưa phải cấu hình đã chốt.

Kết luận đúng phạm vi: *ADR-0002 không bị bác bởi chi phí truy vấn ở mức đã đo* —
chưa phải *phương án này chắc chắn đủ nhanh khi chạy thật*.

## Việc sinh ra từ đây

- ADR-0002 đủ điều kiện chuyển **Accepted** (chủ dự án xác nhận).
- WMS-2 phải: chốt kích thước pool tường minh, đo lại **qua Prisma**, và mang theo
  cảnh báo suy giảm 624% ở mục 3.
