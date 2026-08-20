# WMS-1 — Chi phí lượt đọc phiên (hồ sơ ĐÓNG, 2026-08-20)

**Ticket đóng theo quyết định A6 của chủ dự án: nhận con số, bỏ harness.**
File này là bản ghi cuối, viết một lần và không sinh lại được nữa — trình sinh
báo cáo đã bị xoá cùng script đo (lý do ở mục cuối).

## Con số — thứ duy nhất trong hồ sơ này đã được kiểm chứng độc lập

| | |
|---|---|
| Thống kê | p95 GỘP trên toàn bộ request, tại pool 20 |
| Cỡ mẫu | **14.000** request (7 lần lặp × 2 hồ sơ dữ liệu, 200 người đồng thời) |
| p50 / **p95** / p99 | 3,403 / **5,2031** / 6,22001 ms |
| Lớn nhất | 7,278 ms |
| Trần | 50 ms (10% ngân sách 500 ms, NFR-PER-02) |
| Vượt trần | **0 / 14.000 request** |

**Vì sao con số này đáng tin trong khi harness thì không:** reviewer R1 đã tính
lại p95 **độc lập** từ 14.000 mẫu thô nằm trong `do-p95.json` (`thoTongMs`), bằng
cài đặt riêng và đối chiếu `numpy.percentile` — khớp tới chữ số cuối:
`5,2031 = 5,2031 = 5,2031`. Ai muốn kiểm lại cũng chỉ cần đọc mảng đó, không phải
tin bất kỳ dòng nào của tôi và cũng không cần chạy lại script.

Đo theo cách đọc mà **A4** đã chốt: trần 50 ms áp cho **TOÀN BỘ** chi phí thêm của
một request, gồm cả thời gian chờ lấy kết nối (xem ADR-0002 §Sửa đổi 1).
Tiêu chí phán quyết theo **ADR-0002 §Sửa đổi 2** (p95 gộp trên ≥5.000 request),
sau khi R1 chứng minh tiêu chí cũ ("lấy lần xấu nhất") đo thời lượng đo chứ không
đo hệ thống.

## Điều số liệu nói mà thiết kế cần nhớ

- **Thành phần lớn nhất là hàng đợi kết nối, không phải CSDL.** Chờ pool p95 xấu
  nhất 5,836 ms so với truy vấn 0,793 ms. Ở phần thân phân phối, chỉnh pool mới
  giải quyết được; tối ưu SQL thì không.
- **Rác trong bảng phiên không làm chậm.** Bảng phình lên 506 MB / 2.000.200 dòng,
  vượt xa `shared_buffers` 128 MB, mà trung vị không xấu đi. Dọn phiên hết hạn là
  chuyện dung lượng đĩa.
- **Pool 40 tệ hơn pool 20; pool 10 và 20 thì không phân biệt được** (R1 kiểm bằng
  Mann-Whitney). Chọn 20 vì dư địa khi tăng số bản sao, không phải vì nó nhanh hơn 10.

## Giới hạn — con số này KHÔNG chứng minh những điều sau

1. Mô hình tải là "cả 200 người ập vào cùng lúc", không phải trạng thái ổn định.
   Bi quan ở hàng đợi đến, nhưng **lạc quan ở ba chỗ**: chỉ MỘT pool đập vào CSDL
   (quy tắc ADR giả định 3 bản sao); pool ở đây chỉ phục vụ đúng một câu truy vấn
   phiên, còn thật thì gánh mọi truy vấn của mọi request; không có thời gian nghĩ
   nên cache luôn nóng.
2. Không có độ trễ mạng — CSDL cùng máy với tiến trình đo.
3. Không đo qua Prisma, dù ADR-0001 chọn Prisma 7 + `@prisma/adapter-pg`.
4. Chỉ đo lượt ĐỌC. Ghi `thao_tac_cuoi_luc` và nhánh xoá phiên hết hạn chưa đo.
5. `shared_buffers` 128MB và `max_connections` 100 là mặc định của image, chưa
   phải cấu hình chạy thật — **OPN-03** quyết cái đó.

Kết luận đúng phạm vi: *ở cấu hình pool 20 trên máy phát triển, với mô hình tải
bùng nổ, chi phí thêm của một request nằm dưới trần 50 ms trong toàn bộ 14.000
request đã đo.* Chưa phải *phương án này chắc chắn đủ nhanh khi chạy thật*.

## Hai khẳng định SAI đã từng nằm trong hồ sơ này — ghi lại để không ai trích nhầm

1. **`r = 0,920`** từng được in trong báo cáo như một số đo của lần chạy này. Nó là
   **viết cứng**, lấy từ một lần đo khác của R1. Tính từ chính `do-p95.json` thì
   **r = 0,706**. Kết luận định tính vẫn đúng (những cú vọt kéo cả chờ-pool lẫn
   truy-vấn cùng lúc, tức là cú khựng của cả máy chứ không phải hàng đợi), nhưng
   con số cụ thể thì đừng trích.
2. **`do-p95.json` có trường `quanSat.khongChamDia`** nói *"EXPLAIN (ANALYZE,
   BUFFERS) … shared hit, read=0"*. **Script chưa từng chạy EXPLAIN.** Đó là một
   khẳng định tay được nhét vào file bằng chứng. Điều nó nói thì đúng — R1 đã tự
   chạy EXPLAIN và xác nhận `shared hit=10, read=0` — nhưng **người đo là R1 ở
   vòng review, không phải script**. JSON được giữ nguyên byte để chuỗi kiểm chứng
   của R1 còn giá trị; ghi cải chính ở đây thay vì sửa file.

## Vì sao harness bị xoá (A6)

`scripts/do-p95-phien.mjs` và `scripts/sinh-bao-cao-wms1.py` đã bị xoá. Chúng qua
3 lần viết và 5 vòng review mà vẫn còn năm khiếm khuyết chưa vá, hai trong đó nguy
hiểm nếu ai đó chạy lại:

- **Trình sinh báo cáo nói dối trên dữ liệu TRƯỢT.** R1 nạp vào một lần chạy có
  86,11% request vượt trần; báo cáo vẫn in *"nằm dưới trần 50 ms"* và *"đủ điều
  kiện chuyển sang Accepted"*.
- **2/4 lần SIGINT sớm bị lờ hoàn toàn** — không log, không thoát.
- Script ghi vào đường dẫn bằng chứng chuẩn **vô điều kiện**, nên một lần chạy thử
  40 mẫu đã từng thay được bằng chứng đã commit.
- Cột "trung vị" thực ra là max của hai hồ sơ, làm lật thứ hạng pool.
- Mô hình tải chưa bị khoá trong điều kiện của ADR: hạ tải rồi chạy lâu vẫn thoả.

Muốn đo lại thì phải dựng harness mới — đó là việc đã được cân nhắc và **cố ý
hoãn** (A6 phương án a). Toàn bộ chi tiết của 5 vòng review nằm ở
[`dev/review.md`](dev/review.md); nó là phần đáng đọc nhất của hồ sơ này.
