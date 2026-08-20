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

> ⚠️ **Hai cách dưới đây LOẠI TRỪ NHAU.** Chạy cả hai thì cả hai cùng đòi cổng
> 5432, và bind loopback của Homebrew **thắng** bind wildcard của container — mọi
> kết nối `@localhost:5432` sẽ rơi vào Homebrew trong khi bạn tưởng đang dùng
> container. `SELECT 1` xanh với cả hai nên không có gì báo động. Đã có một phiên
> chạy toàn bộ migration nhầm server vì đúng chuyện này ([KI-003](docs/qa/known-issues.md)).
> Kiểm bằng `lsof -nP -iTCP:5432 -sTCP:LISTEN` (thấy hai tiến trình là đã sai) và
> `bash .vteam/db-check.sh` (nay in tên server + database).
>
> **SRS §2.3 yêu cầu triển khai dạng container, nên Cách 1 là đường mặc định.**

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

### Tầng spec cục bộ (bắt buộc trước khi làm ticket)

Quyết định Q3+Q4 (`docs/pm/decisions.md`) giữ repo public, nên **toàn bộ**
`docs/specs/` — cả bản nguồn lẫn shard — bị gitignore và **không có trong bản
clone**. Máy mới phải tự dựng lại, nếu không thì mọi ticket trích `docs/specs/…`
đều trỏ vào chỗ trống:

```bash
# 1. chép SRS/SRD (.docx) vào docs/ — hỏi chủ dự án, chúng không nằm trong repo
# 2. sinh bản nguồn markdown
python3 scripts/docx_to_md.py docs/SRS_StockFlow_WMS_v1.0.docx docs/specs/sources/SRS.md
python3 scripts/docx_to_md.py docs/SRD_StockFlow_WMS_v1.0.docx docs/specs/sources/SRD.md
# 3. cắt thành shard theo màn hình + sinh INDEX
python3 scripts/shard_spec.py
```

Cả hai script đều tất định (cùng .docx → cùng byte), nên hai máy dựng ra cùng
một tầng spec. **Đó là thứ duy nhất giữ shard trung thực**: gate `verbatim`
không dùng được dưới Q3 (xem [Bảo mật](#bảo-mật)).

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

## Nhánh và PR

| Nhánh | Vai trò |
|---|---|
| `main` | Nhánh phát hành. Không commit trực tiếp. |
| `develop` | **Nhánh tích hợp — mọi PR merge vào đây.** Khai báo ở `git.protected_branch`. |
| `feat/WMS-<n>-<slug>` / `fix/WMS-<n>-<slug>` | Nhánh làm việc. Grammar do `git.branch_pattern` cưỡng chế. |

Hook `.githooks/pre-push` cưỡng chế: không push trực tiếp vào `develop`, quét bí
mật trên toàn bộ nội dung đi ra, và mọi nhánh có diff chạm `src/` hoặc `prisma/`
phải đúng grammar **và** có review dossier `evd/<TICKET>/dev/review.md` đã commit
với card R1, R2 (+R3 khi diff chạm `review.high_stakes_paths`).

> Hook chỉ bảo vệ được **một** nhánh — nhánh ghi ở `git.protected_branch`. Vì vậy
> `main` cần branch protection cấu hình trên GitHub; hook không canh `main`.

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

- SRS/SRD phân loại **"Nội bộ / Confidential"** nhưng repo GitHub đang **public**.
  Quyết định Q3+Q4 (2026-08-19): giữ public, **toàn bộ tầng spec chỉ ở máy** —
  `docs/*.docx|pdf|html` và cả `docs/specs/` đều gitignore. Ba hệ quả đã ĐO,
  không phải suy đoán:
  - `specs.sources` **phải giữ rỗng vĩnh viễn**. `verbatim_gate.py:37-38` gọi
    `sys.exit` khi source thiếu, mà `verbatim` là step của `gate.sh` chạy trên
    mọi push/PR ⇒ khai báo sources = **CI đỏ vĩnh viễn**. Gate này do đó không
    canh gì; tính trung thực của shard chỉ được chống lưng bởi hai script tất
    định ở [Tầng spec cục bộ](#tầng-spec-cục-bộ-bắt-buộc-trước-khi-làm-ticket).
  - File bị ignore **không có trong `git worktree`** (đã thử). Việc nào cần đọc
    spec phải chạy trên cây làm việc chính, không giao cho lane nền của `/team`.
  - `dor_check.py:46` chỉ so chuỗi, **không kiểm file tồn tại** → ticket trích
    `docs/specs/…` vẫn qua gate DoR dù người review không có file đó.
  - Chuyển repo sang private thì cả ba hệ quả trên biến mất.
- Token (Jira, DB) chỉ nằm trong `.env` — không bao giờ commit. `.env.example` là
  bản mẫu rỗng.

## Việc chưa làm

- [x] ~~BA chuyển SRS/SRD sang markdown~~ — xong 2026-08-19
      (`scripts/docx_to_md.py`, bằng chứng `evd/BA-nguon-hoa-spec/REPORT.md`).
      `specs.sources` **cố ý để trống vĩnh viễn** theo Q3 — xem [Bảo mật](#bảo-mật).
      Đổi lại: gate `verbatim` không canh gì, đây là nợ đã biết và đã ghi sổ.
- [ ] **34/36 thực thể chưa mô hình hoá.** `prisma/schema.prisma` chỉ có 2 thực
      thể mà SRS §5.2 đặc tả tới từng cột; phần còn lại chờ SA.
- [ ] **Chưa có migration nào.** Migration đầu tiên phải viết SQL thủ công cho
      CHECK constraint (BRULE-12), REVOKE UPDATE/DELETE trên `chuyen_dong_kho`
      (BRULE-13) và phân vùng theo tháng.
- [ ] **Chưa có xác thực/phân quyền** (SC-20 và ma trận RBAC).
- [ ] **Chưa có Dockerfile** cho app (`output: 'standalone'`) — thuộc DevOps.
- [x] ~~`test:integration`~~ — có từ WMS-2 (`vitest.integration.mts`, 27 test trên
      PostgreSQL thật). **Nhưng CI chưa chạy nó**: `vteam-gate.yml` không khai báo
      service Postgres nào, và bước `integration` là bước `tail` nên
      `gate.sh` không tham số bỏ qua nó. Đường duy nhất chạm tới là `gate e2e`, mà
      đường đó vẫn đỏ vì `test:e2e` chưa tồn tại.
- [ ] **Chưa có `test:e2e`** — chưa có màn hình nào để chạy.
- [ ] **CI chưa áp migration lên Postgres trắng.** Với repo mà `prisma/migrations/`
      là high-stakes path, đây là bước rẻ nhất còn thiếu.
- [x] ~~JIRA_BASE_URL~~ — xong 2026-08-19, preflight xanh cả 7 chân.
- [ ] **Chưa có ticket nào trong Jira** (`project = WMS` trả về 0). Backlog là
      việc kế tiếp của BA: shard → user story → gate B4.
