# ADR-0001 — Stack: Next.js + Prisma + PostgreSQL

- **Trạng thái:** **Accepted** (không còn điều kiện) — OPN-03 đã chốt **đám mây
  công cộng** ngày 21/08/2026, tức điều kiện treo ở đây đã được đáp ứng.
- **Ngày:** 19/08/2026
- **Bối cảnh tài liệu:** SRS TP-WMS-SRS-001 v1.0 §2.3, §2.4; SRD TP-WMS-SRD-001 v1.0 OPN-03

## Bối cảnh

SRS **không chốt** ngôn ngữ, framework hay hệ quản trị CSDL. Nó chỉ đặt ràng buộc:

| Nguồn | Ràng buộc |
|---|---|
| §2.3 | Ứng dụng web đáp ứng, tối ưu từ 1366×768; không làm mobile ở GĐ 1 |
| §2.3 | Máy chủ ứng dụng triển khai **dạng container**, chạy nhiều bản sao sau load balancer |
| §2.3 | RDBMS hỗ trợ **ACID**, cô lập tối thiểu **READ COMMITTED**, **khoá bản ghi tường minh** |
| §2.3 | Hạ tầng: đám mây hoặc data center nội bộ — **chờ OPN-03** |
| DC-01 | Chỉ hoạt động trực tuyến, không có chế độ offline ở GĐ 1 |
| DC-03 | Chuỗi hiển thị phải tách khỏi mã nguồn để đa ngôn ngữ về sau |
| DC-05 | Mọi thay đổi tồn kho phải nằm trong **một giao dịch DB duy nhất** |
| DC-06 | Ngày `dd/MM/yyyy`, số `1.234,5`, múi giờ UTC+7 |

## Quyết định

- **Next.js 16** (App Router, TypeScript, Tailwind v4) cho web đáp ứng. Chọn khi
  khởi tạo dự án; profile `nextjs-prisma` của vteam-harness có sẵn bộ gate đầy đủ
  nhất (typegen → tsc → test → build → token-check).
- **PostgreSQL 17** làm RDBMS: đáp ứng ACID, mặc định READ COMMITTED, có
  `SELECT ... FOR UPDATE` cho khoá bản ghi tường minh mà DC-05 cần.
- **Prisma 7** làm ORM/migration. Prisma 7 bỏ `url` khỏi `schema.prisma`:
  Migrate đọc từ `prisma.config.ts`, runtime kết nối qua driver adapter
  `@prisma/adapter-pg` (xem `src/lib/prisma.ts`).
- **Vitest** cho unit test.

## Hệ quả

- Deploy dạng container: Next.js `output: standalone` cần được bật khi dựng
  Dockerfile — **chưa làm**, thuộc phần việc DevOps.
- Prisma **không** sinh được CHECK constraint (BRULE-12) và **không** quản lý
  GRANT/REVOKE (BRULE-13, sổ chuyển động chỉ cho INSERT). Hai thứ này phải viết
  SQL thủ công trong migration đầu tiên, và vì thế cần `SHADOW_DATABASE_URL`.
- Phân vùng bảng `chuyen_dong_kho` theo tháng (SRS §5.2.2) cũng nằm ngoài khả
  năng của Prisma schema — cần SQL thủ công, và phụ thuộc OPN-03.
- `Decimal(18,3)` map sang `Prisma.Decimal` (decimal.js), **không** dùng
  `number` — mọi tính toán số lượng phải giữ kiểu Decimal để không sai số float.

## Phương án đã cân nhắc

- **Profile `generic`** — hoãn quyết định stack tới khi SA phân tích xong. Bị
  loại vì gate sẽ không kiểm được gì về code, dự án chạy mà không có verification.
- **Prisma 6** — quen tay hơn, nhưng mọi bản 6.13+ kéo `deepmerge-ts` 7.x có lỗ
  hổng GHSA-ggr8-5vv4-36mx (high) và không bản stable nào của Prisma 6/7 dùng
  bản đã sửa. Chọn Prisma 7.9.1 + `overrides: { "deepmerge-ts": "^8.0.1" }`
  → `npm audit` sạch. Cần bỏ override khi Prisma phát hành bản đã cập nhật.

## Chưa quyết định

- **OPN-03** — cloud công cộng hay data center nội bộ. Ảnh hưởng thiết kế phân
  vùng bảng `chuyen_dong_kho` (SRS §7 ghi nhận đây là vấn đề mở).
- Cơ chế xác thực/phân quyền (SC-20, ma trận quyền §RBAC) — chưa chọn thư viện.
