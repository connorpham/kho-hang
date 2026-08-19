# WMS-1 — hồ sơ review

Diff: `scripts/do-p95-phien.mjs` + `evd/WMS-1/`. Không chạm `src/` hay `prisma/`
nên không chạm `review.high_stakes_paths` → 2 reviewer, không cần R3.
Model theo `docs/team/model-routing.md`: R1 = opus (workhorse), R2 = sonnet (standard).

**KẾT QUẢ VÒNG 1: cả hai REQUEST-CHANGES. Kết luận của WMS-1 bị rút lại.**

---

## R1 (opus) — lăng kính: tính đúng đắn của phép đo và tính chính đáng của kết luận

**VERDICT: REQUEST-CHANGES**

| # | Finding | Bằng chứng của reviewer |
|---|---|---|
| CHẶN 1 | `evd/WMS-1/REPORT.md:3-4` tuyên bố 22,363 ms / 4,47% nhưng `do-p95-output.txt:9,11` ghi 20,255 ms / 4,05% — **khối trích dẫn và file bằng chứng là HAI lần chạy khác nhau**, 6/6 dòng số lệch. Dòng `exit=0` trong file bằng chứng không do script in ra → file được ghép tay | `diff <(sed -n '1,11p' do-p95-output.txt) <(sed -n '10,21p' REPORT.md)` → 6/6 dòng lệch |
| CHẶN 2 | **Kết luận không tái lập.** 14 lần chạy không sửa gì: 1 lần cho p95 = 80,862 ms → `ADR-0002 PHẢI MỞ LẠI`, exit=1. Một quyết định kiến trúc nhị phân treo trên thống kê lật ~1/14 lần | 14 lần chạy: 80,862 / 16,408 … 27,613 ms |
| CHẶN 3 | **96,4% con số quyết định là thời gian CHỜ POOL, không phải thời gian truy vấn.** `do-p95-phien.mjs:126-128` bấm giờ bao trọn `pool.query`; `:133` bắn 200 promise qua pool 20 → hàng đợi 180 ngay lập tức | Tách đo: chờ pool p95 = 24,085 · truy vấn p95 = 1,579 · tổng 24,977 |
| CHẶN 3b | Con số bám vào hằng số tuỳ ý chứ không bám vào CSDL: cùng 2000 lượt, đổi 200×10 → 20×100 thì p95 tụt 24,98 → **2,539 ms**; đổi `LUOT_MOI_NGUOI` 10→50 thì p95 **giảm** còn 17,35 ms. Tăng tải mà số đẹp lên = đang đo cái harness | quét tham số 4 cấu hình |
| CHẶN 4 | Viện dẫn NFR-PER-05 ba lần rồi bỏ qua chính tiêu chí của nó: `phi-chuc-nang.md:22` định nghĩa là "không suy giảm quá 20%", script không bao giờ đo mức suy giảm. Theo số của chính báo cáo: 0,209 → 22,363 ms = **suy giảm 10.600%** | đọc chéo REPORT.md:13 vs :18 |
| CHẶN 5 | `do-p95-phien.mjs:162` `Math.max` của hai p95 thuộc hai tổng thể khác nhau không phải phân vị của phân phối nào. Hệ quả: con số mà AC của ticket yêu cầu (p95 của 1.000 lượt) **không bao giờ ảnh hưởng tới phán quyết** — nó thành đồ trang trí | |
| Ghi nhận 8 | **Lạc quan giả đã đo được:** `shared hit=7, read=0` — không một lượt I/O nào; toàn bộ dữ liệu nằm trong `shared_buffers` 128MB (bảng 6 MB). 200 phiên sống nằm trên **2 trang heap** (~16 KB). Id phiên `song-1..200` (6–9 ký tự) trong khi ADR-0002 bắt id ngẫu nhiên đủ entropy (≥43 ký tự) → index nhỏ và không phân tán. **50.000 phiên rác vô tác dụng**: HETHAN=0 → 1,303 ms · 50.000 → 1,579 · 2.000.000 → 1,336 | `EXPLAIN (ANALYZE, BUFFERS)`, `pg_total_relation_size` |
| Ghi nhận 9 | Pool không được làm nóng → ~60% cú "nhảy 110 lần" là chi phí bắt tay TCP+auth của 20 kết nối lạnh. Làm nóng trước: tổng p95 24,98 → **9,99 ms** | |
| Ghi nhận 7 | Truy vấn đo KHÔNG hoàn toàn là truy vấn ADR-0002 điều khoản 2: thiếu join `VaiTro` (NFR-SEC-04 bắt mọi request biết vai trò → đường đi thật là 3 bảng), thiếu cột `taoLuc`/`diaChiIp` nên dòng hẹp hơn thực tế, nhánh "xoá phiên hết hạn khi gặp lúc đọc" **về cấu tạo không thể kích hoạt** trong harness này | |
| Ghi nhận 10 | "Hạt cố định → hai lần chạy cùng dãy" chỉ đúng cho pha 1; pha 2 có 200 closure dùng chung một biến khả biến. Chú thích pool 20 là "SRS §2.3" trong khi chính ADR C-3 nói đó là giả định | |
| Ghi nhận 6 | **`phanVi` (`:36-43`) ĐÚNG** — khớp từng chữ số với `numpy.percentile` (linear/R-7). Không phải chỗ cần sửa | mảng 1..10 → 9,55 ✓ |

**MY WEAK SPOT (R1):** cú 80,862 ms chỉ bắt được một lần, chưa chứng minh được
nguyên nhân; 14 lần là mẫu nhỏ để nói về đuôi phân phối. R1 chạy trên cùng máy
với tác giả nên chia sẻ cùng nguồn nhiễu. Con số 96,4% đo bằng `pool.connect()`
+ `client.query` chứ không phải đúng dòng `pool.query`.

---

## R2 (sonnet) — lăng kính: độ bền và an toàn vận hành

**VERDICT: REQUEST-CHANGES**

| # | Finding | Bằng chứng của reviewer |
|---|---|---|
| CHẶN 1 | `:169-170` `DROP SCHEMA` trong `finally` không có timeout → session khác giữ `ACCESS EXCLUSIVE` thì script treo bằng đúng thời gian khoá | dựng khoá 6s → script thoát sau 6s (bình thường <1s) |
| CHẶN 2 | `:48-171` SIGINT/SIGTERM không có handler → **Ctrl-C bỏ lại schema `do_thu` vĩnh viễn** trên CSDL. Đây là hệ quả trực tiếp của CHẶN 1: script tưởng như treo → dev Ctrl-C → rác ở lại | `kill -INT` giữa chừng → `\dn` vẫn còn `do_thu`; `kill -9` cũng vậy |
| CHẶN 3 | `:46-51` không có rào chắn nào trước `DROP SCHEMA CASCADE` + tải 200 kết nối. **`--env-file-if-exists=.env` KHÔNG ghi đè `DATABASE_URL` đã export trong shell** → script âm thầm chạy vào CSDL khác. Script không nằm trong `gates.yaml`/CI nên không có lưới an toàn nào khác | `DATABASE_URL=... node --env-file-if-exists=.env -e 'console.log(...)'` → in giá trị của shell |
| CHẶN 4 | `:51` `DROP SCHEMA IF EXISTS do_thu CASCADE` chạy vô điều kiện, không cảnh báo khi ghi đè | tạo `do_thu.bao_cao_that` chứa dữ liệu → chạy script → mất sạch, im lặng |
| Ghi nhận 5 | `:129,133,136` một nhánh throw thì `pool.end()` chạy ngay, 179/200 promise treo vĩnh viễn (không reject). Đã verify **không rò rỉ kết nối** (`pg_stat_activity` về 0) — chỉ là code smell nếu tái dùng ở tiến trình sống lâu | |
| Ghi nhận 6-7 | `pg` là dependency trực tiếp thật (`package.json:33`) ✓. Mã thoát phân biệt đúng 3 trạng thái (0 đạt / 1 vượt ngưỡng / 2 lỗi), không mất output — chạy 15 lần qua pipe ✓ | |

**MY WEAK SPOT (R2):** test trên Postgres brew chứ không phải container của repo,
nên các con số thời gian tuyệt đối chỉ minh hoạ cơ chế. Chưa cô lập trường hợp
throw giữa lúc INSERT 50.200 dòng.

---

## Phản hồi của tác giả (vòng 1)

Không tranh luận điểm nào. Cả 11 finding chặn đều đứng vững và đều kèm lệnh chạy.

Ba cái đau nhất, ghi lại để không lặp:

1. **CHẶN 1 của R1 là lỗi liêm chính của bằng chứng, không phải lỗi kỹ thuật.**
   Tôi chạy script một lần để xem, rồi chạy LẦN HAI để ghi ra file, nhưng dán số
   của lần MỘT vào REPORT.md. Rồi `echo "exit=$?" >>` nối thêm một dòng mà script
   không hề in. Kết quả là một file bằng chứng trông chuẩn nhưng không chống lưng
   cho con số nó được cho là chống lưng. Không có cách nào bào chữa: đây đúng
   loại lỗi mà gate bằng chứng sinh ra để bắt.
2. **CHẶN 3 của R1: tôi đo cái harness của chính mình.** Tôi thêm pha đo có tải
   vì tự nhận thấy đo tuần tự là chưa đủ — nhưng lại bấm giờ bao trọn thời gian
   chờ pool, nên 96% con số là hàng đợi do tôi tự tạo. Việc tôi tự khen ở
   REPORT.md rằng "con số lúc rảnh rỗi là con số đánh lừa" hoá ra đúng theo một
   nghĩa tôi không ngờ: con số thay thế của tôi cũng đánh lừa, chỉ theo hướng khác.
3. **CHẶN 3/4 của R2: tôi viết một script `DROP SCHEMA` mà không hỏi nó đang trỏ
   vào CSDL nào.**

## Việc phải làm trước khi WMS-1 được đưa lại vào vòng review

- Tách thời gian truy vấn khỏi thời gian chờ pool; kích thước pool là biến khảo
  sát riêng, không phải hằng số giấu trong kết luận.
- Làm nóng pool trước khi đo (Ghi nhận 9).
- Id phiên ngẫu nhiên đủ entropy theo ADR-0002, không phải `song-1..200` (Ghi nhận 8).
- Join thêm `VaiTro` cho đúng đường đi mà NFR-SEC-04 bắt buộc (Ghi nhận 7).
- Lặp toàn bộ phép đo N lần, báo phương sai và trường hợp xấu nhất — bỏ hẳn
  `Math.max` của hai tổng thể khác nhau (CHẶN 2, CHẶN 5).
- Đo ĐÚNG tiêu chí NFR-PER-05: mức suy giảm so với nền một người dùng, so với
  ngưỡng 20% (CHẶN 4).
- Chỉ ra rằng dữ liệu rác có tác dụng, hoặc bỏ nó và nói thẳng là không có tác
  dụng — không trình bày nó như sức ép thật (Ghi nhận 8).
- Rào chắn CSDL đích + handler SIGINT/SIGTERM + `lock_timeout` khi dọn + cảnh báo
  khi ghi đè schema có sẵn (R2 CHẶN 1–4).
- Sinh lại bằng chứng từ **một lần chạy duy nhất**, không ghép tay dòng nào.

---

# VÒNG 2 (re-review) — bản viết lại

## R2 (sonnet) — VERDICT: **APPROVE**

Cả 4 finding chặn vòng 1: **ĐÃ XỬ LÝ**, mỗi cái kèm tái hiện.
`kill -INT`/`kill -TERM` → schema được dọn, exit 130/143 (`kill -9` vẫn bỏ lại —
giới hạn hệ điều hành, không runtime nào bắt được SIGKILL). Khoá ACCESS EXCLUSIVE
15s → thoát sau đúng 5s với `canceling statement due to lock timeout`. Host lạ →
từ chối **trước khi mở kết nối**; `WMS1_CHO_PHEP_HOST` đúng thì qua. Schema có sẵn
chứa dữ liệu → từ chối, dữ liệu còn nguyên; `--ghi-de` thì cảnh báo rồi mới xoá.

Ghi nhận không chặn: `:87-88` `SET lock_timeout`/`statement_timeout` áp theo
SESSION nên `INSERT` 2 triệu dòng sau đó cũng thừa hưởng `statement_timeout=30s`.

**MY WEAK SPOT (R2):** test trên Postgres brew chứ không phải image
`postgres:17-alpine` của repo; chưa ép lỗi giữa lúc pha tải 200 kết nối đang chạy.

## R1 (opus) — VERDICT: **REQUEST-CHANGES**

Tổng: **6 đã xử lý · 3 nửa vời · 0 chưa đụng** + 4 finding mới.
Kết luận trung tâm đứng vững: R1 đánh 8 lần, phán quyết **không lật lần nào**
(6 lần hoàn tất: 1,666 / 1,778 / 1,895 / 1,958 / 4,618 / 8,397 ms trên ngưỡng 50 ms).
Tái sinh REPORT.md từ JSON đã commit → **byte-identical, 0 dòng lệch** (CHẶN 1 vòng 1
đã đóng hẳn).

### MỚI-1 · CHẶN — cách đọc điều kiện của ADR-0002 quyết định phán quyết

`docs/adr/0002-...:86-89` viết điều kiện là *"mỗi request cộng thêm một lượt đi
CSDL … nếu nó ăn quá 10% ngân sách 500 ms"*. **Việc lấy kết nối là một phần của
lượt đi đó.** Trong 6 lần chạy hoàn tất của R1, **riêng chờ pool p95 đã vượt trần
50 ms hai lần: 160,246 ms và 56,961 ms** — vượt trước khi cộng một mili giây truy
vấn nào. Theo cách đọc thẳng của ADR thì 2/6 lần chạy là TRƯỢT.

Việc tách chờ pool khỏi phán quyết — vốn là cách sửa finding vòng 1 — **chính là
thứ đang giữ phán quyết ở ĐẠT**. Nặng hơn: `:180,205,258` chỉ lưu `tCho` và
`tTruyVan` thành hai mảng rời, JSON chỉ giữ tóm tắt → **p95 của tổng không khôi
phục được từ bằng chứng**. Người đọc muốn con số trung thực cũng không tính lại được.

### MỚI-2 · CHẶN nhẹ — harness bằng chứng không chạy lại được ổn định

`:88` đặt `statement_timeout='30s'` lên session rồi `:124-127` INSERT 2 triệu dòng.
R1 đo tay bằng psql: **INSERT mất 26,185 s** — dư 3,8 s (15%). R1 bắt được **3 lần
script thoát exit=2 với SQLSTATE 40P01 tại đúng câu lệnh đó**, không sinh ra bằng
chứng nào. Hỏng an toàn (schema không bị bỏ lại, JSON không bị ghi đè dở), nhưng
một harness bằng chứng không chạy lại được theo yêu cầu thì vẫn phải sửa.

### MỚI-3 · không chặn ở cấu hình hiện tại, CHẶN cho WMS-2

`:182-184` `Promise.all(POOL × pool.connect())`: khi POOL ≥ `max_connections` (=100)
một phần `connect()` bị từ chối, **client đã lấy không bao giờ được release,
`pool.end()` không bao giờ resolve** → treo vô hạn, không output, không exit code.
R1 chạy POOL=100: treo >75 s, phải `kill -9`, để lại schema, và trong lúc đó **cả
máy không ai connect được vào CSDL dev** (`FATAL: sorry, too many clients already`).
Đây đúng là cái bẫy mà REPORT.md bảo WMS-2 đi vào.

### MỚI-4 · không chặn — bệnh cũ tái phát ở quy mô nhỏ

`REPORT.md:60,81` ghi suy giảm **624%** và bảo WMS-2 mang theo con số đó; 6 lần chạy
của R1 cho 454,1 / 486,2 / 509,8 / 528,9 / 536,9 / 581,3 / 1009,8 %. `:53-54` ghi chờ
pool "gấp 6,1 lần"; R1 đo 6,2x–19,1x. Dấu hiệu định tính thì ổn định (cảnh báo 20%
bật 100% số lần chạy); con số lẻ tới một chữ số thập phân thì không.

### Ba finding vòng 1 mới xử lý nửa vời

- **CHẶN 3b** — POOL vẫn là hằng số cứng `:40`, chỉ được dán nhãn "GIẢ ĐỊNH". Vòng 1
  đòi coi nó là **biến khảo sát**. R1 quét: POOL=5 → căn cứ 0,629 ms · POOL=20 →
  2,466 ms — **3,9 lần chênh chỉ vì đổi một hằng số**.
- **CHẶN 5** — phán quyết đã sạch (max của cùng một thống kê), nhưng `:248-250`
  `suyGiamTyLe` vẫn ghép max(truyVanTai.p95) của **lần 5** ÷ max(nen.p95) của **lần 2**.
- **Ghi nhận 8** — entropy ✓, rác trả lời bằng số ✓, nhưng **"dữ liệu nằm gọn trong
  cache" vẫn đúng nguyên và vẫn không có trong mục Giới hạn**. R1 đo trực tiếp:
  `EXPLAIN (ANALYZE, BUFFERS)` trên bộ 2.000.200 dòng / 506 MB → `shared hit=10,
  read=0, Execution Time 0.030 ms`. **Phép đo không chạm đĩa một lần nào.**

*Nit:* `evd/WMS-1/do-p95.json` chưa `git add` — toàn bộ lập luận "bằng chứng máy
ghi" sụp nếu file không đi cùng PR.

**MY WEAK SPOT (R1):** không truy được đối tác khoá của deadlock 40P01; 3 lần hỏng
dồn vào 3 lần thử đầu nên không loại trừ được nhiễu môi trường. Con số chờ pool
160 ms / 57 ms đo trên máy lập trình đang mở IDE, không cô lập. Không đo được p95
của tổng vì script không lưu cặp giá trị, nên lập luận MỚI-1 phải đứng trên "riêng
chờ pool đã vượt trần" chứ không đứng trên số đầu-cuối thật.

---

## Phản hồi của tác giả (vòng 2) — không có vòng ba

Không tranh luận điểm nào. Cả bốn finding mới đều đứng.

**MỚI-1 không phải lỗi code, nó là câu hỏi về cách đọc ADR-0002 — và đó không phải
việc tôi tự quyết.** "Một lượt đi CSDL" có gồm việc lấy kết nối hay không:
- Gồm → 2/6 lần chạy TRƯỢT, ADR-0002 phải mở lại, và kích thước pool trở thành một
  quyết định kiến trúc chứ không phải tham số vận hành.
- Không gồm → phán quyết ĐẠT đứng, nhưng ADR phải nói thẳng rằng chi phí lấy kết
  nối nằm ngoài trần 50 ms và phải có trần riêng cho nó.

Trớ trêu là vòng 1 bảo tôi đang đo cái harness, vòng 2 bảo việc tách ra đã loại một
chi phí có thật khỏi phán quyết. Cả hai đều đúng, và điểm chung là con số này vô
nghĩa cho tới khi kích thước pool được chốt — đúng thứ R1 đòi từ vòng 1 (CHẶN 3b)
mà tôi đẩy sang WMS-2.

**Đã hết vòng phản biện.** WMS-1 có dòng hỏng thứ hai → theo loop guard #3, máy
không tự chọn lại nữa; chuyển sang mục việc-của-chủ-dự-án kèm cả hai lý do hỏng.
Tôi KHÔNG sửa CODE ĐO sau vòng review này: MỚI-1 có thể đổi hẳn thứ phải đo (lưu
cặp giá trị theo từng lượt, báo cả hai cách đọc), nên sửa trước khi biết cách đọc
nào đúng chỉ là đoán. Thay đổi DUY NHẤT tôi làm sau vòng review là gắn khối cảnh
báo lên đầu REPORT.md (qua trình sinh, không chép tay số nào) — để một phán quyết
đang bị tranh cãi không đứng đó như một sự thật đã chốt. Đó là sửa tính trung
thực, không phải sửa finding.
