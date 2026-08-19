# WMS-1 — Chi phí lượt đọc phiên (điều kiện chốt ADR-0002)

> **File này do máy sinh** từ `evd/WMS-1/do-p95.json` bằng
> `scripts/sinh-bao-cao-wms1.py`. Không con số nào chép tay.
> Lần viết **3** · đo lúc `2026-08-19T11:03:09.731Z`
>
> **Đọc theo:** TỔNG chờ pool + truy vấn — A4 (2026-08-19) chốt trần 50 ms GỒM chi phí lấy kết nối; ADR-0002 Sửa đổi 1

## Phán quyết

**ADR-0002 ĐẠT điều kiện của chính nó, ở cấu hình pool 20.**

p95 của **TỔNG** (chờ lấy kết nối + truy vấn), lần **xấu nhất** trong
7 lần lặp × 2 hồ sơ dữ liệu: **40.745 ms**
trên trần **50 ms** (10% ngân sách
500 ms, NFR-PER-02).

Trung vị của các lần lặp là **12.4 ms** — tức trường hợp thường gặp còn
cách trần khoảng **4.0 lần**. Nhưng xem mục Ổn định
trước khi tin con số này.

## Kích thước pool là biến, không phải hằng số

ADR-0002 Sửa đổi 1 biến pool thành quyết định kiến trúc. Đây là số liệu cho quyết
định đó — cùng phép đo, chỉ đổi kích thước pool:

| Pool | TỔNG p95 trung vị (ms) | TỔNG p95 xấu nhất (ms) | Dưới trần 50 ms? |
|---|---|---|---|
| 10 | 13.5 | 19.7 | ✅ |
| 20 ← | 12.4 | 40.7 | ✅ |
| 40 | 18.3 | 45.5 | ✅ |

`max_connections` của CSDL: **100**. Quy tắc của ADR là ràng
buộc TỔNG (`số bản sao × pool + dự phòng ≤ max_connections`), nên pool 20 cho
tối đa 3 bản sao vẫn còn 40 kết nối dự phòng.

Đáng chú ý: **pool lớn hơn không tốt hơn.** Pool 40 tệ hơn pool 20 ở cả trung vị
lẫn xấu nhất — thêm kết nối chỉ chuyển hàng đợi từ pool sang chính CSDL.

## Ổn định — phần phải đọc trước khi trích con số đi đâu

7 lần lặp tại pool 20, TỔNG p95 từng lần:

| Hồ sơ | Số dòng | MB | TỔNG p95 mỗi lần (ms) | Trung vị | Xấu nhất |
|---|---|---|---|---|---|
| `sach` | 200 | 0.1 | 20.3 · 13.1 · 17.3 · 11.0 · 12.4 · 11.9 · 11.4 | 12.4 | 20.3 |
| `rac_2_trieu` | 2,000,200 | 506.3 | 11.9 · 10.7 · 10.5 · 40.7 · 10.3 · 11.9 · 11.4 | 11.4 | 40.7 |

Các lần lặp bám sát nhau quanh trung vị, **trừ một điểm vọt lẻ** đẩy con số xấu
nhất lên 40.7 ms. Điểm vọt đó nằm ở phần **chờ lấy kết nối**
(39.9 ms), không phải ở truy vấn
(2.4 ms). Chưa quy được nguyên nhân: phép đo chạy trên
máy lập trình đang mở IDE, không cô lập. **Kết luận ĐẠT dựa trên lần xấu nhất
quan sát được, không phải trên một cận đã chứng minh.**

## Ba điều số liệu nói

**1. Thành phần lớn nhất là hàng đợi kết nối, không phải CSDL.** Chờ pool xấu
nhất **39.9 ms** so với truy vấn
**2.4 ms**. Tối ưu câu SQL không giải quyết được gì ở
đây; chỉnh pool và số bản sao mới giải quyết.

**2. Rác trong bảng phiên không ảnh hưởng tốc độ.** Bảng phình lên
506 MB / 2,000,200
dòng, vượt xa `shared_buffers` 128MB, mà TỔNG p95 không xấu đi
theo. Dọn phiên hết hạn là chuyện **dung lượng đĩa**, không phải tốc độ.

**3. Suy giảm khi 200 người đồng thời:
4147–17793%** qua các
lần lặp (vượt mốc cảnh báo 20%).
**Đây là số liệu, không phải phán quyết NFR-PER-05.** NFR-PER-05 là tiêu chí ở mức màn hình (thời gian phản hồi đầu cuối). Phép đo này đo một thành phần nên KHÔNG kết luận đạt/trượt NFR-PER-05. Con số suy giảm ở đây là cảnh báo mang sang WMS-2.

## Giới hạn — những gì con số này KHÔNG chứng minh

1. **Mô hình tải là "cả 200 người ập vào cùng lúc"**, không phải
   200 người dùng ở trạng thái ổn định có thời gian nghĩ. Đây là
   **cận bi quan**: hàng đợi thực tế nhiều khả năng nhẹ hơn. Nó cũng là lý do phần
   chờ pool áp đảo.
2. **Không chạm đĩa lần nào.** EXPLAIN (ANALYZE, BUFFERS) trên bộ 2 triệu dòng cho shared hit, read=0 — toàn bộ tập nóng nằm trong shared_buffers. Phép đo này KHÔNG chạm đĩa lần nào.
3. **Không có độ trễ mạng** — CSDL cùng máy với tiến trình đo.
4. **Không đo qua Prisma.** ADR-0001 chọn Prisma 7 + `@prisma/adapter-pg`; chi phí
   lớp ORM chưa nằm trong con số này.
5. **Chỉ đo lượt ĐỌC.** Ghi `thao_tac_cuoi_luc` (gộp 60 giây) và nhánh xoá phiên
   hết hạn khi gặp lúc đọc đều chưa đo.
6. **Máy lập trình, `shared_buffers` và `max_connections` đều là mặc định** —
   hạ tầng thật còn chờ OPN-03, và chính nó quyết định hai con số đó.

Kết luận đúng phạm vi: *ở cấu hình pool 20 trên máy phát triển, chi phí thêm của
một request nằm dưới trần 50 ms trong mọi lần đo* — chưa phải *phương án này chắc
chắn đủ nhanh khi chạy thật*.

## Việc sinh ra từ đây

- ADR-0002 Sửa đổi 1: quyết định tạm **pool 20/bản sao, tối đa 3 bản sao** có số
  liệu chống lưng → đủ điều kiện để chủ dự án chuyển sang Accepted.
- WMS-2: đặt kích thước pool tường minh bằng 20, và đo lại **qua Prisma**.
- OPN-03 chốt xong thì `max_connections` và số bản sao mới ra con số cuối cùng.
