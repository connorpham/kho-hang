# Knowledge base — lessons in transit, not in residence

## §0 — Reading and graduation rules

- Pipelines read ONLY this section + the INDEX table, then open just the lessons
  whose tags match the current work. Never read the whole file.
- **Graduation over accumulation.** A lesson's destiny is to LEAVE this file:
  machine-checkable → into a gate script (with mutation proof); unconditional →
  into the workflow's own text; recurring environment pattern → into
  known-issues.md (KI-nnn). After graduating, delete it here.
- Cleanup thresholds: INDEX > 25 rows or file > 250 lines → a consolidation pass
  becomes due work.
- A rule that cannot go RED gets skipped — if a lesson keeps being violated,
  it isn't a lesson, it's a missing gate.

## INDEX

| Title | Tags | Where it graduates to |
|---|---|---|
| Bằng chứng phải sinh từ MỘT lần chạy | evidence, dev, qa | gate `evd_check` — cần một quy tắc đỏ được |

## Bằng chứng phải sinh từ MỘT lần chạy, và không được nối tay dòng nào

**Chuyện đã xảy ra (WMS-1, 2026-08-19).** Tác giả chạy script một lần để xem kết
quả, chạy LẦN HAI để ghi ra file bằng chứng, rồi dán số của lần MỘT vào báo cáo.
Sau đó `echo "exit=$?" >> file` nối thêm một dòng mà script không hề in ra. File
bằng chứng trông hoàn toàn chuẩn. Reviewer R1 bắt được bằng đúng một lệnh:
`diff <(sed -n '1,11p' output.txt) <(sed -n '10,21p' REPORT.md)` → 6/6 dòng số
lệch. Nếu lọt, một ADR kiến trúc đã được chốt bằng con số không kiểm được.

**Quy tắc.** Báo cáo bằng chứng phải trích từ ĐÚNG file bằng chứng đã ghi, và
file đó phải là stdout/stderr nguyên vẹn của một lần chạy duy nhất. Cần mã thoát
thì để script tự in ra, đừng nối bằng shell.

**Điều kiện khiến lỗi này có thể xảy ra, chứ không chỉ là bất cẩn.** `.gitignore:3-6`
cho `evd/**` bị ignore trừ `*.md` và `*.json`. Nghĩa là file stdout thô
(`do-p95-output.txt`) **không commit được** — hiện vật duy nhất vào repo là file
`.md` do người viết tay, và trong repo không có gì mâu thuẫn được với nó. Vì vậy
quy tắc trên phải kèm cách làm: ghi output thô thành `.json`, hoặc dán nguyên
văn vào khối mã trong `.md` **cùng lần chạy đó** — đừng để nó ở một file `.txt`
mà repo không giữ.

**Vì sao chưa graduate được sang gate.** `evd_check.py` hiện không so khối trích
dẫn trong REPORT.md với file output. Muốn thành luật đỏ được thì phải thêm phép
so đó — chừng nào chưa có, đây vẫn là bài học trong này chứ không phải gate.
