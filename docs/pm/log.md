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
