# Decision queue — everything that needs the owner, in one place

Statuses: `🔴 OPEN` · `🟡 PROVISIONAL (machine) <date> — pending acceptance` ·
`✅ DECIDED <date>`. Rows are NEVER deleted. Deadlines are real dates
(YYYY-MM-DD) — a deadline written as words is invisible to every reminder
machine (schedule_check warns on them).

## 1. Open questions

| # | Question (searched-where · two-sided proposal · reversal cost) | Blocks | Status | Due |
|---|---|---|---|---|
| Q1 | **Ngày go-live Giai đoạn 1 là ngày nào?** `project.go_live` không tồn tại trong `vteam.config.yaml`, `docs/pm/plan.yaml` chỉ có comment mẫu, README không nêu mốc. (a) Chốt một ngày cứng cho 20 màn hình SC-01→SC-20 → `schedule_check.py` tính được "đúng hạn hay trượt N person-day" và desk report có câu dẫn bằng số; (b) để trống, chỉ theo dõi từng sprint → không có cảnh báo trượt, chỉ biết trễ khi đã trễ. Chi phí đảo ngược: THẤP (sửa một dòng config). | Mọi phép đo tiến độ; desk report | 🔴 OPEN | 2026-08-21 |
| Q2 | **Sprint-1 mở từ ngày nào đến ngày nào?** `docs/pm/plan.yaml` chưa có sprint nào → `schedule_check.py` ĐỎ ("2026-08-19 falls in no sprint of the plan"). (a) Mở sprint-1 20/08→02/09 (10 ngày làm việc × `capacity_per_day 0.8` = 8 person-day) và nạp item ngay khi BA có backlog; (b) hoãn tới khi BA shard xong spec → gate schedule còn đỏ thêm vài ngày, nhưng plan không phải sửa lại. Chi phí đảo ngược: THẤP. | schedule_check; điều phối /dev | 🔴 OPEN | 2026-08-21 |
| Q3 | **Repo GitHub để public hay chuyển private?** SRS/SRD phân loại "Nội bộ / Confidential" (README §Bảo mật) nên `docs/*.docx|pdf|html` đang bị gitignore. Hệ quả: ngay khi BA trỏ `specs.sources` vào bản markdown nguồn, gate `verbatim` xanh ở local nhưng ĐỎ trên CI vì file không có ở đó. (a) Chuyển repo sang private, bỏ khối ignore → verbatim canh đúng bản gốc, CI xanh; (b) giữ public, chỉ commit bản markdown đã lược phần mật → verbatim chỉ canh bản đã lược, oracle yếu hơn và mọi trích dẫn spec phải tự kiểm bằng tay. Chi phí đảo ngược: (a) rẻ khi làm TRƯỚC lúc tài liệu mật lên public — rất đắt sau đó (không rút lại được thứ đã public). | BA nguồn hoá spec (việc đầu tiên của BA); gate `verbatim` trên CI | 🔴 OPEN | 2026-08-21 |

## 2. Owner-only actions

| # | Action | Why machine-exempt | Status | Due |
|---|---|---|---|---|
| A1 | **Cấp Jira cho preflight.** `preflight.sh` báo `API unreachable (Expecting value: line 1 column 1)` — `/rest/api/3/myself` trả về không phải JSON, tức sai `JIRA_BASE_URL` (phải là `https://<site>.atlassian.net`, không phải link giao diện) hoặc `JIRA_API_TOKEN` sai/rỗng. README §Việc chưa làm cũng đã ghi nhận. Sửa `.env` rồi chạy lại `bash .vteam/scripts/preflight.sh`. Jira project phải có key `WMS`. | `credentials` nằm trong `autonomy.exemptions`; token chỉ ở `.env`, agent không tạo/không đọc được | 🔴 OPEN | 2026-08-20 |
| A2 | **Dựng DB cục bộ.** Cổng 5432 đóng; Docker.app có nhưng daemon tắt và CLI `/usr/local/bin/docker` là symlink gãy; `postgresql@17` cài qua brew nhưng service `none`. Chọn một: (a) mở Docker Desktop rồi `docker compose up -d db` — khớp yêu cầu container hoá của SRS §2.3; (b) `brew services start postgresql@17 && createdb stockflow_wms && createdb stockflow_wms_shadow` — nhanh hơn, lệch với SRS §2.3 ở phần triển khai. Xác nhận bằng `bash .vteam/db-check.sh`. | Khởi động service hệ thống + tạo database trên máy chủ sở hữu; `autonomy.level: assisted` giữ quyền này ở người | 🔴 OPEN | 2026-08-20 |

## 3. ADRs pending

| ADR | Decision | Status |
|---|---|---|
