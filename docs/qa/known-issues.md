# Known issues — KI-nnn registry

Dedup every new finding against this list BEFORE calling it a bug. Environment
quirks, recurring tool failures, and accepted deviations live here with stable
ids so reports can cite them.

<!-- ## KI-001 · <title>
Symptom: …
Cause: …
Workaround: … -->

## KI-001 · `docker` không có trên PATH dù Docker Desktop đã cài
Symptom: `docker: command not found` (hoặc `no such file or directory`) trong khi
Docker Desktop đang chạy bình thường; `.vteam/db-check.sh` và mọi bước dựng DB
đều trượt, preflight đỏ ở chân Database.
Cause: `/usr/local/bin/docker` là symlink trỏ `/Volumes/Docker/Docker.app/...`
— đường dẫn của ổ đĩa DMG lúc cài, đã tháo từ lâu. Binary thật nằm ở
`/Applications/Docker.app/Contents/Resources/bin/docker`.
Workaround: gọi bằng đường dẫn tuyệt đối
`/Applications/Docker.app/Contents/Resources/bin/docker compose up -d db`.
Sửa dứt điểm cần quyền root → đã đăng ký A3 trong docs/pm/decisions.md §2.

## KI-002 · `dor_check.py` dò bằng chuỗi tiếng Anh trong dự án viết tiếng Việt
Symptom: ticket viết tiếng Việt đầy đủ vẫn trượt gate DoR ở mục "no out-of-scope
section"; ngược lại, ticket UI viết tiếng Việt lại LỌT qua luật bắt buộc có link
thiết kế — gate xanh mà không canh gì.
Cause: `dor_check.py` dùng regex tiếng Anh cứng — `OOS = (out of scope|out-of-scope)`
(dòng 23), `NO_UI = \bno UI\b` (24), và luật ticket-UI chỉ kích hoạt khi mô tả
chứa `screen|page|UI` (dòng 50). Mô tả tiếng Việt ("Ngoài phạm vi", "màn hình")
không khớp regex nào.
Workaround: mô tả ticket phải chứa nguyên văn các chuỗi tiếng Anh `out of scope`,
`no UI` (khi không có giao diện), giữ từ khoá `Given/When/Then`, và link thiết kế
phải có tiền tố `mockup:` / `design node:` / URL figma. Đã ghi thành mục bắt buộc
ở cuối `docs/backlog/sc-01-dang-nhap-draft.md`.
Sửa dứt điểm: bổ sung từ khoá tiếng Việt vào regex của dor_check — thuộc harness
vteam, không sửa trong repo này.

## KI-003 · Hai PostgreSQL cùng đòi cổng 5432 — mọi thứ chạy nhầm server trong im lặng
Symptom: `db-check.sh` xanh, migration chạy "thành công", test xanh — nhưng
container `stockflow-db` trống trơn và `stockflow_wms_shadow` "không tồn tại" dù
`prisma/init/01-shadow-db.sql` đã chạy đúng lúc khởi tạo (log có `CREATE DATABASE`).
Cause: README mời dùng **cả hai** cách dựng CSDL — container (`docker compose up -d db`)
và Homebrew (`brew services start postgresql@17`) — mà chúng loại trừ nhau. Container
bind `*:5432` (wildcard), Homebrew bind `127.0.0.1:5432` và `[::1]:5432` (cụ thể).
**Bind cụ thể thắng bind wildcard**, nên mọi kết nối `@localhost:5432` rơi vào
Homebrew. Shadow DB chỉ tồn tại trong container nên biến mất khỏi tầm với.
Chẩn đoán: `lsof -nP -iTCP:5432 -sTCP:LISTEN` — hai tiến trình là đã sai.
`bash .vteam/db-check.sh` nay in `version()` + `current_database()` + `max_connections`;
container là `PostgreSQL 17.10` (musl), Homebrew là `17.11 (Homebrew)`.
Workaround: `brew services stop postgresql@17`, rồi chạy lại migration.
Sửa dứt điểm: chọn MỘT cách dựng CSDL (SRS §2.3 yêu cầu container), hoặc đổi cổng
container sang 5433. README đã sửa để nói rõ hai cách loại trừ nhau.
Phát hiện bởi reviewer R2 ở vòng review WMS-2, sau khi tác giả ghi nhầm nguyên
nhân là "chưa quy được".

