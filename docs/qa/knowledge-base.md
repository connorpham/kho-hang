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
| Báo cáo máy sinh phải sinh cả KẾT LUẬN, không chỉ số | evidence, dev | gate: nạp một bộ dữ liệu TRƯỢT vào trình sinh, báo cáo phải nói TRƯỢT |
| KI-005 · dụng cụ đo phải công bố nhiễu của chính nó | evidence, dev, security | gate: script đo phải in khoảng của nhánh chứng và tự VÔ HIỆU khi nhiễu ≥ hiệu ứng |

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


## Báo cáo máy sinh phải sinh cả KẾT LUẬN, không chỉ các con số

**Chuyện đã xảy ra (WMS-1, 2026-08-19).** Sau khi bị bắt lỗi chép tay con số, tác
giả viết một trình sinh báo cáo nội suy mọi SỐ từ file JSON bằng chứng, và ghi ở
đầu file: *"không khẳng định nào được viết cứng"*. Reviewer nạp vào đó JSON của một
lần chạy **TRƯỢT** (86,11% request vượt trần). Báo cáo sinh ra in đúng "TRƯỢT" và
đúng "60277/70000 vượt trần" ở phần số — rồi ở hai đoạn kết luận vẫn nói *"nằm dưới
trần 50 ms"* và *"đủ điều kiện để chủ dự án chuyển sang Accepted"*. Hai câu đó là
đúng hai câu người ra quyết định sẽ đọc.

**Quy tắc.** Trong một báo cáo máy sinh, mọi câu KHẲNG ĐỊNH về dữ liệu (so sánh,
xếp hạng, "không có điểm vọt", "đủ điều kiện chấp nhận") phải là hàm của dữ liệu,
y như các con số. Câu nào chưa tính được thì đừng viết.

**Cách kiểm rẻ và đỏ được:** giữ một bộ dữ liệu TRƯỢT làm fixture, nạp vào trình
sinh, và đòi báo cáo phải nói TRƯỢT ở cả phần số lẫn phần kết luận. Đây là dạng
kiểm mutation, và khác với bài học ở trên, **nó viết thành gate được** — đó là
việc còn nợ.

## KI-004 — Cổng xanh đo được cái nó biết đo, và tôi là người dạy nó

**Bối cảnh.** WMS-3, 2026-08-20. Bản đầu qua toàn bộ cổng: 111 test xanh, `tsc`
sạch, lint sạch, `GATE: GREEN 13/13`, cổng bằng chứng giao diện xanh. Vòng review
ba người tìm ra **bảy lỗi thật**, ba trong số đó nghiêm trọng.

**Vì sao cổng không thấy.** Không bước nào của cổng:
- gửi **hai yêu cầu cùng lúc** ⇒ cuộc đua bộ đếm làm khoá tài khoản vô hiệu,
- cầm **đồng hồ** ⇒ bốn lý do từ chối chênh 200 lần dù giống hệt câu chữ,
- gửi **dữ liệu rác** ở tầng biên ⇒ header không phải IP làm mất dòng nhật ký,
- chạy ở **cấu hình sai** ⇒ khai thừa số chặng proxy thì hỏng-mở.

Bốn góc mù đó không ngẫu nhiên: **tôi viết bộ test, nên nó chỉ phủ những gì tôi
đã nghĩ tới.** Một cổng do tác giả tự dựng đo được năng lực tưởng tượng của tác
giả, không đo được tính đúng của hệ thống.

**Bốn phép thử nên có mặt trong MỌI ticket chạm trạng thái dùng chung:**

1. **Gửi song song.** Mọi test đọc-rồi-ghi phải có bản `Promise.all`. Cặp biên
   của test tuần tự là test đồng thời.
2. **Bấm giờ, không chỉ so chữ.** Khi thiết kế cố ý làm các nhánh giống nhau về
   câu chữ (như G-01), câu chữ mất khả năng phân biệt — chỉ còn thời gian và
   trạng thái CSDL nói thật. Và phải đo ở **nhiều mức đồng thời**: một sàn thời
   gian chỉ che được khi nó còn bó.
3. **Dữ liệu rác ở biên**, không chỉ dữ liệu hợp lệ.
4. **Cấu hình SAI.** Reviewer R2 tự ghi: *"vòng 1 tôi đo hệ thống ở đúng cấu hình
   mà tài liệu nói, tôi chưa bao giờ thử một cấu hình sai"* — và chính đề xuất
   của họ hỏng ở đó.

**Bài học nặng nhất, lặp lần thứ ba trong dự án.** Tôi viết "Next.js server
action không đọc được địa chỉ socket" mà **không kiểm**, rồi chép nó vào năm chỗ
— gồm một file migration (vĩnh viễn) và một câu hỏi gửi chủ dự án (làm họ phải
chọn giữa hai phương án tồi). Sửa xong, tôi lập tức lặp lại đúng khuôn: viết
"khai thừa chặng thì trả không biết", chép vào sáu chỗ, kèm hai test chọn đầu vào
theo điều mình mong. **Quy tắc rút ra: một khẳng định về hành vi của thư viện
hoặc hạ tầng phải có một lệnh chạy được đứng sau TRƯỚC KHI nó được viết lần thứ
hai.** Chép một câu chưa kiểm rẻ hơn kiểm nó, và đó chính là lý do nó lan.

**Hệ quả cho quy trình.** `evd_ui_check` và `gate.py` xanh **không phải** tín
hiệu sẵn sàng merge; chúng là điều kiện cần để *bắt đầu* review. Ba reviewer độc
lập tìm ra bảy lỗi mà mười ba bước cổng bỏ lọt — tỉ lệ đó nói rằng vòng review là
lớp phát hiện chính, không phải lớp xác nhận.

## KI-005 — Dụng cụ đo phải công bố nhiễu của chính nó, nếu không nó là cái máy phát phán quyết

**Bối cảnh.** WMS-3, 2026-08-20, ba phiên liên tiếp. Mỗi phiên tôi đóng kênh phụ
thời gian, chạy `scripts/do-kenh-phu.mjs` của chính mình, nhận PASS, commit tệp
kết quả làm bằng chứng. Mỗi phiên reviewer mở lại nó bằng cách **đổi đúng một
con số trong chính công cụ đó** — `ln=14`→`16`, rồi thêm một dòng `ln=17` — và
công cụ tự in "chưa đạt", exit 1.

**Vì sao ba lần đều lọt.** Vòng ba R1 đo bằng khách HTTP thô thay Chromium:

| | khoảng đọc được, cùng nhánh, cùng K=24 |
|---|---|
| công cụ của tôi (Chromium) | `[321,6 … 1003,7]` — rộng **682 ms** |
| khách HTTP thô | `[524,8 … 526,2]` — rộng **1,4 ms** |

Tín hiệu cần bắt: **8–164 ms**. Nhiễu của dụng cụ gấp **bốn lần** tín hiệu lớn
nhất. Nên câu `hai khoảng rời nhau? không` mà tôi đọc là "đã đóng" thật ra là
tính chất của **trình duyệt**, không phải của hệ thống. Tệ hơn: ở K=24 công cụ
báo nhánh `ln=14` **nhanh hơn** nhánh không-tồn-tại, trong khi phép đo sạch cho
thấy nó **chậm hơn 24%**, 6/6 vòng, khoảng rời hẳn. **Dụng cụ báo sai cả dấu.**

**Điều đắt nhất:** con số bác bỏ nằm sẵn trong tệp tôi commit làm bằng chứng
THÀNH CÔNG (`evd/WMS-3/dev/kenh-phu-thoi-gian.txt:15`). Một lệnh `grep`, năm
giây, ở bất kỳ vòng nào trong ba vòng. Tôi đọc dòng KẾT LUẬN và bỏ qua cột số
ngay bên trên nó.

**Luật, đỏ được bằng máy:**

1. **Phép đo nào tuyên một phán quyết thì phải in nhiễu nền của chính nó**, đo
   trên **cùng một nhánh lặp lại**. Khoảng của nhánh chứng ≥ hiệu ứng cần bác
   bỏ ⇒ phán quyết là **VÔ HIỆU**, không phải PASS. Đây là một câu `if` trong
   script, không phải kỷ luật đọc hiểu.
2. **Điểm đo không được cắm cứng khi CSDL biết câu trả lời.** `do-kenh-phu.mjs`
   cắm cứng ba bậc và phân loại "hiện hành" bằng cách so hai chuỗi — nên mọi bậc
   mới tự rơi vào rổ phải-đạt. Truy vấn `SELECT split_part(mat_khau_hash,'$',3),
   count(*) GROUP BY 1` là câu tôi đã chạy tay trong cùng một phiên. Ba dòng mã
   đó sẽ tự bắt được lỗi này thay vì để reviewer bắt lần thứ tư.
3. **Đừng đo qua một tầng dày hơn thứ cần đo.** Kẻ tấn công dùng `curl`, không
   dùng Chromium. Dụng cụ phải mỏng hơn hiệu ứng.

**Điểm chung với KI-004, và là lý do phải tách thành bài riêng:** KI-004 nói cổng
chỉ phủ những gì tác giả nghĩ tới. KI-005 nặng hơn một bậc — **tôi đã nghĩ tới
đúng thứ cần đo, đặt tên đúng cho nó, viết hẳn một công cụ cho nó, và công cụ
trả lời ngược.** Phủ đủ không cứu được một dụng cụ không hợp lệ.

**Kèm một dạng lỗi anh em, cùng gốc "test không thể đỏ":** chốt SAVEPOINT của
cùng ticket có test mang đúng tên nó, nhưng giả lập bằng `throw` của JavaScript —
mà `throw` không đưa giao dịch Postgres vào trạng thái aborted. Chú thích cả bốn
câu `SAVEPOINT`/`ROLLBACK TO`/`RELEASE` ⇒ **104/104 test vẫn xanh**. Quy tắc:
**khi yêu cầu một chốt phòng thủ, phải kèm luôn phép đột biến chứng minh chốt đó
có người canh** — dòng này áp cho cả tác giả lẫn reviewer.
