# WMS-1 — Chi phí lượt đọc phiên (điều kiện chốt ADR-0002)

> **File này do máy sinh** từ `evd/WMS-1/do-p95.json` bằng
> `scripts/sinh-bao-cao-wms1.py`. Cả **số** lẫn **câu so sánh** đều suy từ dữ liệu —
> không khẳng định nào được viết cứng.
> Lần viết **3** · đo lúc `2026-08-19T11:33:53.574Z` · **TỔNG chờ pool + truy vấn — A4 (2026-08-19) chốt trần 50 ms GỒM chi phí lấy kết nối; ADR-0002 Sửa đổi 1**

## Phán quyết

**ADR-0002 ĐẠT điều kiện của chính nó** (ADR-0002 §Sửa đổi 2), ở cấu hình pool 20.

Thống kê phán quyết: **p95 GỘP trên toàn bộ request ở cấu hình phán quyết** — không phải max của các p95 con. Đổi
tiêu chí vì R1 chứng minh tiêu chí cũ lật phán quyết chỉ bằng cách tăng số lần lặp.

| | |
|---|---|
| Cỡ mẫu | **14,000** request (tối thiểu 5,000) |
| p50 / **p95** / p99 | 3.40 / **5.20** / 6.22 ms |
| Lớn nhất | 7.28 ms |
| Trần | 50 ms (10% ngân sách 500 ms, NFR-PER-02) |

**Không một request nào trong 14,000 request vượt trần 50 ms** — giá trị lớn nhất quan sát được là 7.28 ms, tức còn cách trần 6.9 lần.

Để đối chiếu, con số theo tiêu chí CŨ (max p95 qua các lần lặp) là
6.29 ms. Tiêu chí cũ (max p95 qua các lần lặp) đã bị bỏ: kỳ vọng của max tăng theo số lần lặp nên nó đo thời lượng đo, không đo hệ thống. Con số đó vẫn được ghi ở maxP95QuaCacLanLap để đối chiếu, KHÔNG dùng để phán quyết.

## Kích thước pool

| Pool | TỔNG p95 trung vị (ms) | TỔNG p95 xấu nhất (ms) |
|---|---|---|
| 10 | 5.8 | 7.3 |
| 20 ← | 5.6 | 6.3 |
| 40 | 7.4 | 8.8 |

Theo trung vị, pool **20** cho con số thấp nhất (5.6 ms). Pool 10 (5.8 ms, +4%) **không phân biệt được** với pool 20 ở phép đo này. Pool 40 tệ hơn rõ rệt (7.4 ms, +31%).

`max_connections` = **100**. Quy tắc của ADR là ràng buộc TỔNG
(`số bản sao × pool + dự phòng ≤ max_connections`), nên pool 20 cho tối đa 3 bản
sao còn 40 kết nối dự phòng.

## Ổn định qua 7 lần lặp (pool 20)

| Hồ sơ | Số dòng | MB | TỔNG p95 mỗi lần (ms) | Trung vị |
|---|---|---|---|---|
| `sach` | 200 | 0.1 | 5.0 · 5.9 · 5.6 · 6.3 · 5.3 · 5.6 · 5.9 | 5.6 |
| `rac_2_trieu` | 2,000,200 | 506.3 | 5.3 · 4.7 · 5.0 · 4.6 · 4.6 · 4.6 · 5.0 | 4.7 |

Trong lần chạy này: hồ sơ `sach` **không có điểm vọt** (xấu nhất 6.3 ms so với trung vị 5.6 ms); hồ sơ `rac_2_trieu` **không có điểm vọt** (xấu nhất 5.3 ms so với trung vị 4.7 ms).

## Hai điều số liệu nói

**1. Thành phần lớn nhất là hàng đợi kết nối, không phải CSDL.** Chờ pool xấu nhất
**5.84 ms** so với truy vấn **0.79 ms**.
Ở phần THÂN phân phối, chỉnh pool mới giải quyết được, tối ưu SQL thì không.
Ở phần ĐUÔI thì khác: R1 đo tương quan giữa chờ-pool và truy-vấn trong cùng lần lặp
là **r = 0,920** — những cú vọt kéo cả hai thành phần cùng lúc, tức là cú khựng của
cả máy chứ không phải hiện tượng hàng đợi.

**2. Bảng phình lên 506 MB / 2,000,200 dòng, vượt xa `shared_buffers` 128MB, mà trung vị chỉ đổi -16% (5.6 → 4.7 ms) — **không phân biệt được**. Dọn phiên hết hạn là chuyện dung lượng đĩa, không phải tốc độ.**

Suy giảm **truy vấn** khi 200 người đồng thời (so cùng loại với
nền, cả hai đều không gồm chờ pool):
**393–682%** (vượt mốc cảnh báo 20%).
Đây là số liệu, không phải phán quyết NFR-PER-05. NFR-PER-05 là tiêu chí ở mức màn hình (thời gian phản hồi đầu cuối). Phép đo này đo một thành phần nên KHÔNG kết luận đạt/trượt NFR-PER-05. Con số suy giảm ở đây là cảnh báo mang sang WMS-2.

## Giới hạn — những gì con số này KHÔNG chứng minh

1. **Mô hình tải là "cả 200 người ập vào cùng lúc"**, không phải
   trạng thái ổn định có thời gian nghĩ. Bi quan ở phần hàng đợi đến — nhưng **lạc
   quan ở ba chỗ**, và phải nói cả ba: (a) chỉ MỘT pool đập vào CSDL, trong khi quy
   tắc của ADR giả định 3 bản sao; (b) pool ở đây chỉ phục vụ đúng một câu truy vấn
   phiên, còn trong ứng dụng thật 20 kết nối đó gánh MỌI truy vấn của MỌI request —
   và chờ pool chính là thứ A4 vừa kéo vào trần 50 ms; (c) không có thời gian nghĩ
   nên cache luôn nóng.
2. **Không chạm đĩa lần nào.** EXPLAIN (ANALYZE, BUFFERS) trên bộ 2 triệu dòng cho shared hit, read=0 — toàn bộ tập nóng nằm trong shared_buffers. Phép đo này KHÔNG chạm đĩa lần nào.
3. **Không có độ trễ mạng** — CSDL cùng máy với tiến trình đo.
4. **Không đo qua Prisma** — ADR-0001 chọn Prisma 7 + `@prisma/adapter-pg`.
5. **Chỉ đo lượt ĐỌC** — ghi `thao_tac_cuoi_luc` và nhánh xoá phiên hết hạn chưa đo.
6. **`shared_buffers` 128MB và `max_connections` 100
   đều là mặc định của image**, chưa phải cấu hình chạy thật — OPN-03 quyết cái đó.

Kết luận đúng phạm vi: *ở cấu hình pool 20 trên máy phát triển, với mô hình tải
bùng nổ, chi phí thêm của một request nằm dưới trần 50 ms* — chưa phải
*phương án này chắc chắn đủ nhanh khi chạy thật*.

## Việc sinh ra từ đây

- ADR-0002 (Sửa đổi 1 + 2) có số liệu chống lưng → đủ điều kiện để chủ dự án
  chuyển sang Accepted.
- WMS-2: đặt pool = 20 tường minh, đo lại **qua Prisma**, và đo với nhiều bản sao.
- OPN-03 chốt xong thì `max_connections` và số bản sao mới ra con số cuối cùng.
