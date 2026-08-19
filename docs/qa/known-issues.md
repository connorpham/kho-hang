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

