# WMS-2 — Nền danh tính: NguoiDung, VaiTro, Quyen, Kho, Phien, NhatKyThaoTac

Ticket: WMS-2 · ADR: [ADR-0003](../../docs/adr/0003-mo-hinh-du-lieu-danh-tinh.md) (Proposed)

## Việc này đã làm gì

Mô hình hoá 6 thực thể + 3 bảng nối, và migration đầu tiên của dự án. Trước đó
`prisma/schema.prisma` chỉ có 2 thực thể và `prisma/migrations/` không tồn tại.

**Đường đi hợp lệ là ADR trước, lược đồ sau.** Chính file schema đặt luật: *"34
thực thể còn lại CHƯA có đặc tả cột nên KHÔNG được mô hình hoá ở đây — thuộc phần
việc của SA/BA (ADR + shard spec) để tránh tự phát minh cấu trúc dữ liệu."* Kiểm
tra xác nhận **SRS §5.2 chỉ đặc tả cột cho 3 thực thể** (SoDuTonKho,
ChuyenDongKho, SerialItem) — không có thực thể nào của WMS-2. Nên ADR-0003 được
viết trước, với một luật duy nhất: **mỗi cột phải truy được về một yêu cầu; chỗ
nào không truy được thì không có cột.**

## Bằng chứng — 13 test tích hợp trên PostgreSQL thật

Chúng là test **chạy lại được**, không phải script dùng một lần. Đây là điểm khác
có chủ ý so với WMS-1: bài học từ đó đã ghi vào knowledge-base, và `test:integration`
nay là một bước tail có thật trong `gates.yaml` thay vì một bước luôn bị bỏ qua.

```
$ npm run test:integration
    ✓ src/lib/__tests__/nen-danh-tinh.itest.ts (13 tests) 44ms
         Tests  13 passed (13)
      Duration  213ms (transform 19ms, setup 0ms, collect 24ms, tests 44ms, environment 0ms, prepare 31ms)
```

| AC của ticket | Test chứng minh |
|---|---|
| NguoiDung n–n VaiTro và n–n Kho | khoá chính hai cột trên cả hai bảng nối |
| NFR-SEC-03: không cột mật khẩu đọc được | quét `information_schema`, chỉ có `mat_khau_hash` |
| SRS §8: 9 vai trò mặc định tồn tại | đúng 9 mã, tất cả `la_mac_dinh` |
| BRULE-13 / DI-07: nhật ký chỉ ghi thêm | UPDATE và DELETE trên dòng **đang tồn tại** đều bị chặn (23001) |
| DI-01 / BRULE-12 (ngoài AC, có sẵn từ trước) | số âm bị chặn (23514), số 0 đi qua — cặp biên |
| DI-02 (ngoài AC) | lệch một đơn vị bị chặn, khớp thì đi qua — cặp biên |

## Hai lỗi thật do chính test tìm ra ở vòng chạy đầu

**1. Test "UPDATE bị từ chối" XANH GIẢ khi bảng rỗng.** Trigger `FOR EACH ROW`
không bắn khi không có dòng nào, mà UPDATE trên 0 dòng vốn là no-op. Vòng chạy
đầu ĐỎ đúng chỗ đó. Đã viết lại: dựng dòng thật trong transaction rồi mới thử
sửa/xoá, ROLLBACK ở cuối.

**2. Cột `@updatedAt` không có default ở cấp CSDL — lỗi CÓ TỪ TRƯỚC WMS-2.**
Prisma đặt giá trị đó ở client, nên mọi INSERT bằng SQL thuần vào
`so_du_ton_kho` đều `23502 not_null_violation`. Nghĩa là migration, seed, và
tác vụ đối soát hằng đêm mà **DI-03 yêu cầu** đều không ghi được vào bảng đó.
Đã thêm `@default(now())` cho cả 3 cột (gồm cột có sẵn của `so_du_ton_kho`).

## Quyết định phải nêu rõ: KHÔNG seed ma trận gắn quyền

SRS §8 có bảng đầy đủ 19 màn hình × 9 vai trò với các mức F/C/A/R/–. Bảng đó là
**nội dung spec**, mà Q3+Q4 giữ toàn bộ tầng spec ngoài repo public — nhét nó vào
migration là công bố spec bằng đường vòng.

**Hệ quả nói thẳng:** sau migration này, 9 vai trò TỒN TẠI nhưng CHƯA CÓ quyền
nào. Điều đó thoả AC của WMS-2 và **không** thoả nhu cầu vận hành. Gắn quyền là
việc của SC-20 (FR-20-02) hoặc một seed cục bộ không commit. Có một test canh
đúng điều này (`vai_tro_quyen` phải rỗng) để ai seed vào thì buộc phải đọc lý do.

## BRULE-13: vì sao TRIGGER chứ không phải REVOKE

BRULE-13 nói "thu hồi quyền UPDATE/DELETE". Migration dùng trigger làm lớp cưỡng
chế chính vì **REVOKE không có tác dụng với superuser**, mà môi trường phát triển
kết nối bằng `postgres`. Chỉ REVOKE là một hàng rào không chặn được gì ở đúng nơi
tay dễ trượt nhất. REVOKE cho một vai trò ứng dụng riêng vẫn nên có như lớp thứ
hai, nhưng tạo vai trò đó là quyết định triển khai và **phụ thuộc OPN-03**; SQL để
làm khi OPN-03 chốt đã ghi sẵn trong migration.

## Giới hạn

- `gate e2e` **vẫn đỏ ở bước `e2e`** (`npm run test:e2e` chưa tồn tại — chưa có
  giao diện nào để chạy). Bước `integration` thì nay chạy thật.
- Phân vùng `chuyen_dong_kho` theo tháng: chưa làm, chờ **OPN-03**.
- Không có bảng lịch sử mật khẩu (S-04, sprint-2) và không có cột TOTP (S-06, chờ
  **G-02**) — cả hai là chỗ trống có chủ ý, ghi trong ADR-0003.
- Hai migration thay vì một: cái thứ hai là bản vá `@default(now())` do test tìm
  ra. Giữ tách để lịch sử nói đúng chuyện đã xảy ra.

## Ghi nhận môi trường

`stockflow_wms_shadow` **không tồn tại** dù `prisma/init/01-shadow-db.sql` đã chạy
thành công lúc khởi tạo container (log `CREATE DATABASE` có thật). Thứ gì đó xoá
nó sau đó — **chưa quy được nguyên nhân**. Đã tạo lại bằng tay để chạy migration.
