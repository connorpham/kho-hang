# StockFlow WMS

Hệ thống Quản lý Kho Phân phối B2B — Công ty CP Phân phối Trường Phát.

- Đặc tả: `SRS TP-WMS-SRS-001 v1.0`, `SRD TP-WMS-SRD-001 v1.0` (trong `docs/`, **không commit** — xem [Bảo mật](#bảo-mật))
- Phạm vi Giai đoạn 1: 20 màn hình nghiệp vụ SC-01 → SC-20
- Kiến trúc: [ADR-0001](docs/adr/0001-stack-nextjs-prisma-postgres.md)

> **Trạng thái: nền dự án (base).** Chưa có màn hình nghiệp vụ nào được cài đặt.
> Xem [Việc chưa làm](#việc-chưa-làm) để biết chính xác còn thiếu gì.

## Stack

| Lớp | Lựa chọn |
|---|---|
| Web | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 |
| DB | PostgreSQL 17 · Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Test | Vitest |
| Quy trình | [vteam-harness](https://github.com/connorpham/vteam-harness) 0.7 — PM·BA·SA·DEV·QA + quality gates |

## Cài đặt

```bash
npm install
cp .env.example .env      # rồi điền giá trị thật
```

### Cơ sở dữ liệu

Cách 1 — container (khớp yêu cầu triển khai của SRS §2.3):

```bash
docker compose up -d db
```

Cách 2 — PostgreSQL cài sẵn trên máy (bản này đã có Postgres 17 qua Homebrew):

```bash
brew services start postgresql@17
createdb stockflow_wms && createdb stockflow_wms_shadow
```

Kiểm tra kết nối:

```bash
bash .vteam/db-check.sh
```

### Chạy

```bash
npm run db:generate   # sinh Prisma Client vào src/generated/prisma (gitignored)
npm run dev
```

## Scripts

| Lệnh | Việc |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` / `start` | Build và chạy production |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (một lần) · `npm run test:watch` để theo dõi |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate dev` (cần DB + shadow DB) |
| `npm run gate` | Chạy toàn bộ quality gate của vteam |

## Quy trình làm việc (vteam)

```bash
npx vteam doctor    # preflight: DB, git, tracker, gate selftest
npx vteam board     # dashboard cục bộ, chỉ đọc (127.0.0.1:4177)
npm run gate        # gate đầy đủ; `npm run gate e2e` để gồm cả bước tail
```

Trong Claude Code, mở một ngày làm việc bằng `/team`. Các skill role: `/pm`
`/ba` `/plan` `/dev` `/qa` `/verify` `/docs` `/guidelines`.

Cấu hình duy nhất: [`vteam.config.yaml`](vteam.config.yaml).
Ticket đi qua **Jira** (`project.key = WMS`), nên Jira project phải có key `WMS`.

## Quy tắc nghiệp vụ đã cài đặt

Đây là những chỗ spec đã được chuyển thành code có test, **không** được tính lại
ở nơi khác:

| Nguồn | Cài đặt |
|---|---|
| BRULE-11 (tồn khả dụng) | [`src/lib/ton-kho.ts`](src/lib/ton-kho.ts) — `tinhTonKhaDung` |
| BRULE-12 (tồn không âm) | [`src/lib/ton-kho.ts`](src/lib/ton-kho.ts) — `chanTonAm` |
| DC-03 (tách chuỗi hiển thị) | [`src/lib/i18n/vi.ts`](src/lib/i18n/vi.ts) |
| DC-06 (ngày/số/UTC+7) | [`src/lib/dinh-dang.ts`](src/lib/dinh-dang.ts) |
| SRS §5.2.1, §5.2.2 | [`prisma/schema.prisma`](prisma/schema.prisma) — `SoDuTonKho`, `ChuyenDongKho` |

## Bảo mật

- SRS/SRD phân loại **"Nội bộ / Confidential"** nhưng repo GitHub đang **public**,
  nên `docs/*.docx`, `docs/*.pdf`, `docs/*.html` bị gitignore và chỉ tồn tại trên
  máy bạn. **Hệ quả:** gate `verbatim` không chạy được trên CI. Chuyển repo sang
  private thì bỏ được khối ignore đó.
- Token (Jira, DB) chỉ nằm trong `.env` — không bao giờ commit. `.env.example` là
  bản mẫu rỗng.

## Việc chưa làm

- [ ] **`specs.sources` còn trống** → gate `verbatim` đang không canh gì. Cần BA
      chuyển SRS/SRD sang markdown tại `docs/specs/sources/` rồi khai báo trong
      `vteam.config.yaml`.
- [ ] **34/36 thực thể chưa mô hình hoá.** `prisma/schema.prisma` chỉ có 2 thực
      thể mà SRS §5.2 đặc tả tới từng cột; phần còn lại chờ SA.
- [ ] **Chưa có migration nào.** Migration đầu tiên phải viết SQL thủ công cho
      CHECK constraint (BRULE-12), REVOKE UPDATE/DELETE trên `chuyen_dong_kho`
      (BRULE-13) và phân vùng theo tháng.
- [ ] **Chưa có xác thực/phân quyền** (SC-20 và ma trận RBAC).
- [ ] **Chưa có Dockerfile** cho app (`output: 'standalone'`) — thuộc DevOps.
- [ ] **Chưa có `test:integration` / `test:e2e`** — hai bước `tail` của gate sẽ
      lỗi nếu gọi `npm run gate e2e`.
- [ ] **JIRA_BASE_URL chưa có** → `npx vteam doctor` còn đỏ ở chân Tracker.
