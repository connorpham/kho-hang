# Decision queue — everything that needs the owner, in one place

Statuses: `🔴 OPEN` · `🟡 PROVISIONAL (machine) <date> — pending acceptance` ·
`✅ DECIDED <date>`. Rows are NEVER deleted. Deadlines are real dates
(YYYY-MM-DD) — a deadline written as words is invisible to every reminder
machine (schedule_check warns on them).

## 1. Open questions

| # | Question (searched-where · two-sided proposal · reversal cost) | Blocks | Status | Due |
|---|---|---|---|---|
| Q1 | **Ngày go-live Giai đoạn 1 là ngày nào?** `project.go_live` không tồn tại trong `vteam.config.yaml`, `docs/pm/plan.yaml` chỉ có comment mẫu, README không nêu mốc. (a) Chốt một ngày cứng cho 20 màn hình SC-01→SC-20 → `schedule_check.py` tính được "đúng hạn hay trượt N person-day" và desk report có câu dẫn bằng số; (b) để trống, chỉ theo dõi từng sprint → không có cảnh báo trượt, chỉ biết trễ khi đã trễ. Chi phí đảo ngược: THẤP (sửa một dòng config). | Mọi phép đo tiến độ; desk report | 🟡 PROVISIONAL (machine) 2026-08-19 — pending acceptance | 2026-08-21 |
| ↳ | **Trả lời:** "đặt mốc tạm, chốt lại sau backlog". Máy đặt `project.go_live: 2026-11-24`. Số học ghi ngay tại config: nền (schema 34 thực thể + migration thủ công + auth/RBAC) ~15 pd + 20 màn hình × ~1.5 pd ≈ 45 pd; ÷ 0.8 = 56 ngày làm việc → 2026-11-05; đệm 20% → 2026-11-24. **Cả hai hệ số 1.5 pd/màn hình và 15 pd phần nền là PHỎNG ĐOÁN của máy, chưa có một ước lượng thật nào chống lưng** — thay ngay khi BA có backlog. | | | |
| Q2 | **Sprint-1 mở từ ngày nào đến ngày nào?** `docs/pm/plan.yaml` chưa có sprint nào → `schedule_check.py` ĐỎ ("2026-08-19 falls in no sprint of the plan"). (a) Mở sprint-1 20/08→02/09 (10 ngày làm việc × `capacity_per_day 0.8` = 8 person-day) và nạp item ngay khi BA có backlog; (b) hoãn tới khi BA shard xong spec → gate schedule còn đỏ thêm vài ngày, nhưng plan không phải sửa lại. Chi phí đảo ngược: THẤP. | schedule_check; điều phối /dev | ✅ DECIDED 2026-08-19 | 2026-08-19 |
| ↳ | **Trả lời:** "bắt đầu từ hôm nay luôn" → sprint-1 **19/08 → 01/09** (10 ngày làm việc, 8 pd). Đã ghi vào `docs/pm/plan.yaml`; `schedule_check` XANH: *"Sprint 1 (19/08–01/09): 0.0 pd owed · 8.0 pd capacity left → ON SCHEDULE"*. `items: []` vì Jira chưa có ticket — sprint rỗng mới chỉ chứng minh "hôm nay có nằm trong sprint", chưa đo được tải thật. | | | |
| Q3 | **Repo GitHub để public hay chuyển private?** SRS/SRD phân loại "Nội bộ / Confidential" (README §Bảo mật) nên `docs/*.docx|pdf|html` đang bị gitignore. Hệ quả: ngay khi BA trỏ `specs.sources` vào bản markdown nguồn, gate `verbatim` xanh ở local nhưng ĐỎ trên CI vì file không có ở đó. (a) Chuyển repo sang private → verbatim canh đúng bản gốc; (b) giữ public, commit bản đã lược; (c) giữ public, source chỉ ở local. Chi phí đảo ngược: rẻ khi làm TRƯỚC lúc tài liệu mật lên public, rất đắt sau đó. | BA nguồn hoá spec; gate `verbatim` trên CI | ✅ DECIDED 2026-08-19 — chọn (c) giữ public, source chỉ ở local | 2026-08-21 |
| ↳ | **Hai hệ quả đã đo, không phải suy đoán.** (1) `specs.sources` **phải giữ RỖNG vĩnh viễn**: `verbatim_gate.py:37-38` gọi `sys.exit` khi source thiếu — chạy thử cho ra `SystemExit -> verbatim_gate: source document missing: docs/specs/sources/SRS.md`, mà `verbatim` là một step trong `gates.yaml` và `.github/workflows/vteam-gate.yml` chạy `gate.sh` trên **mọi push và PR** → khai báo sources = CI đỏ vĩnh viễn ở mọi PR. Vậy gate `verbatim` **không canh gì cả** trong suốt vòng đời quyết định này; mọi trích dẫn spec trong shard là lời hứa của con người, không có máy nào kiểm. (2) `.gitignore` đã thêm `docs/specs/sources/` — nếu không, bản markdown nguồn sẽ được commit và toàn văn yêu cầu mật lên repo public, đúng thứ (c) muốn tránh. | | | |
| Q4 | **Shard spec (`docs/specs/*.md`) có commit lên repo public không?** Phát sinh từ Q3 — câu Q3 mới chỉ xử lý *source*, chưa xử lý *shard*, mà theo thiết kế thì shard là **trích nguyên văn** dòng yêu cầu và là "oracle citable của repo" mà /dev, /qa và review agent đều đọc. Tra ở: `.gitignore` (chỉ chặn `docs/*.docx|pdf|html`, không chặn `docs/specs/`), `verbatim_gate.py` (shard = mọi `.md` trong `paths.specs` trừ INDEX/changes/`-draft`/`reviews/`), `docs/team/roles/ba.md`. (a) **Commit shard** → pipeline chạy đúng thiết kế, CI và review agent có oracle; đổi lại nguyên văn yêu cầu nghiệp vụ nằm công khai. (b) **Gitignore cả `docs/specs/`** → không công bố gì, nhưng CI và mọi agent chạy trên máy khác đều mù spec, và cái "oracle" mà /dev /qa giả định là có sẽ không tồn tại — hỏng thiết kế pipeline chứ không chỉ hỏng một gate. (c) **Chuyển repo private** (đảo lại Q3) → mâu thuẫn biến mất, cả verbatim lẫn shard đều lành. Chi phí đảo ngược: (a) KHÔNG ĐẢO NGƯỢC ĐƯỢC một khi đã public. | BA shard spec → toàn bộ backlog → mọi ticket /dev | 🔴 OPEN | 2026-08-20 |

### 1.1 Điểm mở do CHÍNH SPEC khai báo (SRS §TBD, SRD §OPN)

Bản nguồn tự liệt kê **7 TBD + 6 OPN** — đây là câu hỏi của tài liệu gửi chủ đầu
tư, không phải máy nghĩ ra. **Quy tắc ghi ở đây (hệ quả Q3(c)):** chỉ tham chiếu
MÃ và nêu câu hỏi ở mức trung tính — không chép nguyên văn dòng yêu cầu, vì file
này commit lên repo public. Nội dung đầy đủ: `docs/specs/sources/SRS.md` §11 và
`docs/specs/sources/SRD.md` §OPN trên máy bạn.

Ba mục dưới đây spec ghi hạn là "trước khi kết thúc GĐ 0" / "trước GĐ 1A" — tức
là ĐÃ ĐẾN HẠN theo chính tài liệu. Ngày `Due` là do PM quy ra ngày thật (cuối
tuần 2 của sprint-1) vì hạn viết bằng chữ thì không máy nhắc việc nào thấy.

| # | Question (searched-where · two-sided proposal · reversal cost) | Blocks | Status | Due |
|---|---|---|---|---|
| OPN-03 (≡ TBD-07) | **Hạ tầng chạy thật: đám mây công cộng hay trung tâm dữ liệu nội bộ?** Chủ trì theo spec: COO / IT nội bộ. Đã được nhắc công khai sẵn trong `docker-compose.yml`. Ảnh hưởng trực tiếp thiết kế **phân vùng bảng `ChuyenDongKho`** — mà migration ĐẦU TIÊN phải viết SQL thủ công cho phân vùng đó (README §Việc chưa làm). (a) Chốt sớm → migration đầu tiên viết một lần, đúng luôn; (b) chốt muộn → hoặc phải đoán rồi viết lại migration đã chạy trên dữ liệu thật (đắt và rủi ro), hoặc treo toàn bộ phần nền. Chi phí đảo ngược: THẤP bây giờ, RẤT CAO sau khi migration đầu tiên chạy trên dữ liệu thật. | Migration đầu tiên → toàn bộ phần nền → mọi ticket /dev | 🔴 OPEN | 2026-08-26 |
| OPN-02 | **Ngưỡng giá trị điều chỉnh tồn kho cần phê duyệt, và cấp nào phê duyệt?** Chủ trì theo spec: Kế toán trưởng. `điều chỉnh` nằm trong `review.high_stakes_terms` — sai ngưỡng là sai tiền, không phải sai giao diện. (a) Chốt trước khi code màn hình điều chỉnh → luật kiểm soát nằm trong code và test ngay từ đầu; (b) code trước, gắn ngưỡng sau → có một khoảng thời gian hệ thống cho phép điều chỉnh không kiểm soát. Chi phí đảo ngược: TRUNG BÌNH (sửa luật rẻ, nhưng dữ liệu đã điều chỉnh sai thì phải truy hồi). | SC-17 và luồng điều chỉnh tồn | 🔴 OPEN | 2026-08-26 |
| OPN-01 | **Chốt danh sách sàn TMĐT tích hợp trong Giai đoạn 1** (spec tự đề xuất tối đa 2 sàn để kiểm soát rủi ro). Chủ trì theo spec: GĐ Chuỗi cung ứng. Kéo theo TBD-02 (tài khoản đối tác) và TBD-05/OPN-06 (chính sách tồn đệm). (a) Chốt sớm → phạm vi tích hợp đóng, ước lượng Giai đoạn 1 mới đáng tin; (b) để mở → mọi ước lượng go-live còn một ẩn số không chặn trên. Chi phí đảo ngược: TRUNG BÌNH. | SC-20, toàn bộ INT-EC-* | 🔴 OPEN | 2026-08-26 |

**Chưa đăng ký hạn (đăng ký khi việc tương ứng tới gần, tránh hạn giả):**
TBD-01 (SC-06, spec ghi "bắt đầu M2") · TBD-02 (phụ thuộc OPN-01) · TBD-03 (API
ERP, M9) · TBD-04 (SC-17, M7) · TBD-05 (phụ thuộc OPN-06) · TBD-06 (mẫu chứng
từ in, cuối GĐ thiết kế) · OPN-04 (hạn dùng còn lại tối thiểu, trước GĐ 1B) ·
OPN-05 (thiết bị di động, sau vận hành thử) · OPN-06 (tồn đệm TMĐT, trước GĐ 1D).

## 2. Owner-only actions

| # | Action | Why machine-exempt | Status | Due |
|---|---|---|---|---|
| A1 | **Cấp Jira cho preflight.** `preflight.sh` báo `API unreachable (Expecting value: line 1 column 1)` — sai `JIRA_BASE_URL` hoặc `JIRA_API_TOKEN`. Sửa `.env` rồi chạy lại `bash .vteam/scripts/preflight.sh`. | `credentials` nằm trong `autonomy.exemptions`; token chỉ ở `.env`, agent không tạo/không đọc được | ✅ DECIDED 2026-08-19 — xong, preflight báo `Tracker: signed in, project WMS exists` | 2026-08-20 |
| A2 | **Dựng DB cục bộ.** Cổng 5432 đóng; Docker daemon tắt; CLI `/usr/local/bin/docker` là symlink gãy (trỏ `/Volumes/Docker/…` đã tháo). | Khởi động service hệ thống + tạo database trên máy chủ sở hữu | ✅ DECIDED 2026-08-19 — chủ dự án bật Docker; máy chạy `docker compose up -d db`, `db-check.sh` → `DB reachable` | 2026-08-20 |
| A3 | **Sửa symlink docker CLI** (không chặn việc gì hôm nay, nhưng mọi script gọi `docker` trần sẽ trượt): `/usr/local/bin/docker` → `/Volumes/Docker/…` không còn tồn tại; binary thật ở `/Applications/Docker.app/Contents/Resources/bin/docker`. Phiên này phải gọi bằng đường dẫn tuyệt đối để lách. | Sửa symlink trong `/usr/local/bin` cần quyền root | 🔴 OPEN | 2026-08-26 |

## 3. ADRs pending

| ADR | Decision | Status |
|---|---|---|
