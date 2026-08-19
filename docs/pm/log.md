# Dispatch ledger

One row per dispatched item, APPEND AT END (dates non-decreasing — machine-checked
by log_check.py). Result column takes exactly 3 values: `done` · `blocked: <why>` ·
`failed: <which gate>`. Rows from the adoption date carry `· tok ≈ <N>k`.
Actor = the HUMAN whose session dispatched the row — `VTEAM_ACTOR` env if set,
else `git config user.name`; never invented. With `team.size > 1` the column is
machine-mandatory (log_check reds a legacy header and any empty Actor cell).

| Date | Lane | Actor | Item | Result | Link |
|---|---|---|---|---|---|
| 2026-08-19 | PM | Connor Pham | T0 roll call — mở ngày làm việc /team | blocked: preflight ĐỎ (tracker + DB) | docs/pm/sessions/2026-08-19-1539.md |
| 2026-08-19 | PM | Connor Pham | T0 roll call lần 2 sau khi chủ dự án gỡ A1+A2 | done · tok ≈ 6k | docs/pm/sessions/2026-08-19-1539.md |
| 2026-08-19 | PM | Connor Pham | T1 P-DECIDE — Q1 tạm, Q2 chốt, Q3 chốt, Q4 mở | done · tok ≈ 12k | docs/pm/decisions.md |
| 2026-08-19 | BA | Connor Pham | Nguồn hoá SRS/SRD sang markdown (dừng trước shard: Q4) | done · tok ≈ 32k | evd/BA-nguon-hoa-spec/REPORT.md |
| 2026-08-19 | PM | Connor Pham | Q4 — chốt (b), thi hành + bù thiệt hại | done · tok ≈ 14k | docs/pm/decisions.md |
| 2026-08-19 | BA | Connor Pham | Shard spec: 39 file + INDEX + gate --check | done · tok ≈ 26k | scripts/shard_spec.py |
| 2026-08-19 | PM | Connor Pham | T0+T1 phiên 2 — chọn SC-01 làm batch đầu | done · tok ≈ 8k | docs/pm/sessions/2026-08-19-1626.md |
| 2026-08-19 | BA | Connor Pham | Batch #1 SC-01: 1 task + 7 story, dừng ở gate B4 | done · tok ≈ 34k | docs/pm/decisions.md |
| 2026-08-19 | PM | Connor Pham | T0+T1 phiên 3 — T1 SKIP có lý do, chọn ADR-0002 | done · tok ≈ 6k | docs/pm/sessions/2026-08-19-1635.md |
| 2026-08-19 | SA | Connor Pham | ADR-0002 phiên đăng nhập — bản Proposed | done · tok ≈ 22k | docs/adr/0002-phien-dang-nhap-va-thu-hoi-quyen.md |
| 2026-08-19 | PM | Connor Pham | Gate B4 duyệt — tạo 6 ticket WMS-1..6, nạp sprint-1 | done · tok ≈ 18k | WMS-1 |
| 2026-08-19 | DEV | Connor Pham | WMS-1 đo p95 lượt đọc phiên | failed: vòng review 2 người (R1+R2 REQUEST-CHANGES, 11 finding chặn) | evd/WMS-1/dev/review.md |
| 2026-08-19 | PM | Connor Pham | T0+T1 phiên 4 — WMS-1 lần 2/2, T1 SKIP có lý do | done · tok ≈ 5k | docs/pm/sessions/2026-08-19-1747.md |
| 2026-08-19 | DEV | Connor Pham | WMS-1 viết lại lần 2 — R2 APPROVE, R1 REQUEST-CHANGES | failed: vòng review 2 người (MỚI-1: cách đọc điều kiện ADR-0002) | evd/WMS-1/dev/review.md |
| 2026-08-19 | PM | Connor Pham | T0+T1 phiên 5 — 4 quyết định, autonomy full, G-01/G-03 quyết tạm | done · tok ≈ 22k | docs/pm/decisions.md |
| 2026-08-19 | SA | Connor Pham | ADR-0002 Sửa đổi 1+2 — trần gồm chi phí kết nối, điều kiện phủ định được | done · tok ≈ 14k | docs/adr/0002-phien-dang-nhap-va-thu-hoi-quyen.md |
| 2026-08-19 | DEV | Connor Pham | WMS-1 lần viết 3 — 2 vòng review | failed: vòng review 2 người (CHẶN B trình sinh + SIGINT bị lờ) | evd/WMS-1/dev/review.md |
