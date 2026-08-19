# ADR-0002 — Phiên đăng nhập lưu phía máy chủ, thu hồi quyền tức thời

- **Trạng thái:** **MỞ LẠI 2026-08-19** (xem §Sửa đổi 1) — vẫn Proposed, chấp nhận là quyền của chủ dự án
- **Ngày:** 19/08/2026
- **Bối cảnh tài liệu:** SRS §2.3, §4.1 (FR-01-06, FR-01-07), §7.1 (NFR-PER-02,
  NFR-PER-05), §7.3 (NFR-SEC-01, NFR-SEC-04, NFR-SEC-08); SRD BR-22; ADR-0001
- **Luật ghi chép:** theo quyết định Q3/Q4, tài liệu này **tham chiếu bằng MÃ
  yêu cầu** và chỉ nêu tham số kỹ thuật cần cho quyết định — không chép nguyên
  văn câu yêu cầu nào. (Bản thân việc `docs/adr/` vẫn nằm trong repo public là
  một lựa chọn chưa được hỏi lại — xem §Câu hỏi còn treo.)

## Bối cảnh — các lực kéo ngược nhau

BA phát hiện một ràng buộc chéo khi soạn batch SC-01: hai yêu cầu đều bắt buộc
(ưu tiên M) nhưng kéo về hai hướng.

| Nguồn | Ràng buộc | Kéo về hướng nào |
|---|---|---|
| FR-01-07 | Phiên kết thúc sau 30 phút không thao tác, cảnh báo trước 2 phút | Cần biết "lần thao tác cuối" của từng phiên |
| NFR-SEC-08 | Tài khoản bị vô hiệu hoá phải mất hiệu lực trên **mọi phiên đang chạy trong tối đa 2 phút** | Cần thu hồi được một phiên đang sống |
| NFR-SEC-04 | Phân quyền theo vai trò + phạm vi kho, thực thi ở **tầng máy chủ cho mọi điểm cuối** | Mỗi request phải biết vai trò và kho hiện tại |
| FR-01-06 | Kho làm việc chọn sau đăng nhập, đổi được giữa phiên | Bối cảnh kho là trạng thái CỦA PHIÊN, không của tài khoản |
| SRS §2.3 | Máy chủ chạy **nhiều bản sao sau load balancer** | Trạng thái phiên không được nằm trong bộ nhớ một tiến trình |
| NFR-PER-02 | Xác nhận thao tác quét: phân vị 95 dưới 500 ms | Mọi thứ thêm vào đường đi mỗi request đều ăn vào ngân sách này |
| NFR-PER-05 | 200 người dùng đồng thời | Chi phí mỗi request nhân với 200 |
| OPN-03 | Hạ tầng chạy thật chưa chốt | Không được chọn thứ ép trước câu trả lời của OPN-03 |

**Mâu thuẫn cốt lõi:** một token tự chứa (stateless JWT) sống 30 phút **không
thể** thoả NFR-SEC-08 — máy chủ không có chỗ nào để nói "token này hết hiệu lực
từ bây giờ". Đây là lý do vấn đề này là quyết định kiến trúc chứ không phải lựa
chọn thư viện của lập trình viên.

## Các phương án đã cân nhắc

### PA-1 · JWT tự chứa, hạn 30 phút (bị loại)
Không đáp ứng NFR-SEC-08: khoảng thời gian một tài khoản đã bị vô hiệu hoá vẫn
thao tác được lên tới 30 phút, gấp 15 lần cận cho phép. Loại vì vi phạm thẳng
một yêu cầu ưu tiên M.

### PA-2 · JWT hạn ngắn (≤2 phút) + refresh token (bị loại)
Thoả được cận 2 phút bằng cách từ chối refresh. Nhưng: 200 người dùng đồng thời
× refresh mỗi 2 phút ≈ 100 lượt/phút vẫn phải hỏi cơ sở dữ liệu — tức **vẫn tra
CSDL, chỉ là thưa hơn**, đổi lại thêm hẳn một cơ chế (hai loại token, xoay vòng,
chống dùng lại refresh). Đổi kho theo FR-01-06 và đổi vai trò cũng phải chờ tới
chu kỳ refresh mới có hiệu lực. Loại theo nguyên tắc "đơn giản nhất mà vẫn đúng":
trả gần bằng giá của PA-3 nhưng nhiều bộ phận chuyển động hơn.

### PA-3 · Bản ghi phiên trong PostgreSQL, kiểm mỗi request (CHỌN)
Một bảng `Phien` trong CSDL đã có sẵn từ ADR-0001. Mỗi request đọc phiên theo
khoá chính, **join sang cờ hoạt động của `NguoiDung`**.

### PA-4 · Redis làm kho phiên (bị loại)
Nhanh nhất, nhưng thêm một hạ tầng phải vận hành cho đội **một người**, và ép
trước câu trả lời của OPN-03 (đám mây hay data center nội bộ). Nguyên tắc SA #5:
mỗi công nghệ thêm vào là một chi phí vận hành vĩnh viễn. Để dành: nếu đo được
rằng tra phiên là nút cổ chai thật, đổi sang Redis là thay một lớp truy cập, đã
được cô lập sẵn theo §Hệ quả.

## Quyết định

**Phiên đăng nhập là một bản ghi trong PostgreSQL, được xác thực ở tầng máy chủ
trên mọi request, và mang theo bối cảnh kho hiện tại.**

Cụ thể:

1. Bảng `Phien`: khoá chính là mã phiên ngẫu nhiên đủ entropy; các cột
   `nguoiDungId`, `khoHienTaiId`, `taoLuc`, `thaoTacCuoiLuc`, `hetHanLuc`,
   `diaChiIp`. Mã phiên gửi qua cookie `httpOnly` + `Secure` + `SameSite=Lax`
   (NFR-SEC-01 đã bắt TLS).
2. Mỗi request: một truy vấn đọc `Phien` theo khoá chính **join `NguoiDung`**.
   Phiên không tồn tại, đã quá hạn, hoặc tài khoản không còn hoạt động → từ chối.
   **Vô hiệu hoá tài khoản có hiệu lực ngay ở request kế tiếp — 0 phút, không
   phải 2 phút** — vì cờ hoạt động được đọc cùng lúc, không cần quét thu hồi.
3. `thaoTacCuoiLuc` **không ghi mỗi request**: chỉ ghi khi giá trị đang lưu đã cũ
   hơn 60 giây. Đây là đánh đổi có chủ ý, xem §Hệ quả.
4. Đổi kho (FR-01-06) là một lần cập nhật `khoHienTaiId`; mọi bản ghi nhật ký
   lấy kho từ phiên, nhờ đó BR-22 kiểm được ở tầng máy chủ.
5. Truy cập phiên đi qua **một lớp duy nhất** (`src/lib/phien.ts`), không rải
   truy vấn phiên khắp nơi — điều kiện để sau này đổi sang PA-4 mà không sửa 20
   màn hình.

## Hệ quả

### Tiêu cực (phần phải đọc kỹ)

- **Mỗi request cộng thêm một lượt đi CSDL.** Lập luận "khoá chính có chỉ mục thì
  dưới một mili giây" là SUY LUẬN, **chưa có phép đo nào trong dự án này**.
  T-00 phải kèm một phép đo p95 của đường đi này và ghi vào `evd/`; nếu nó ăn quá
  10% ngân sách 500 ms của NFR-PER-02 thì ADR này phải được mở lại.
- **Ngưỡng 30 phút của FR-01-07 trở nên chính xác tới ±60 giây** vì gộp ghi
  `thaoTacCuoiLuc`. Cảnh báo "trước 2 phút" cũng thừa hưởng sai số đó. Nếu chủ dự
  án cần đúng từng giây thì bỏ gộp và trả giá bằng một lượt GHI mỗi request —
  con số đó ở 200 người dùng đồng thời là đáng kể, và phải đo trước khi chọn.
- **Thêm một thực thể mà SRS §5.1 không liệt kê.** SRS đặc tả danh sách thực thể
  tới từng cột; `Phien` là thứ ADR này thêm vào. Phải ghi một dòng vào
  `docs/specs/changes.md` để bản shard và thực tế không nói hai chuyện khác nhau.
- **Bảng phiên tự phình.** Cần một việc dọn phiên hết hạn. Giữ đơn giản: xoá khi
  gặp lúc đọc, cộng một lần quét định kỳ; **chưa quyết chạy quét bằng gì** —
  phụ thuộc OPN-03 (cron trong ứng dụng hay job của hạ tầng).
- **T-00 bị chặn cho tới khi ADR này được chấp nhận**: migration đầu tiên phải
  biết có bảng `Phien` hay không.

### Tích cực

- Không thêm hạ tầng nào, không ép trước OPN-03.
- Thu hồi quyền tốt hơn yêu cầu (0 phút so với cận 2 phút của NFR-SEC-08).
- Bối cảnh kho nằm đúng chỗ của nó: thuộc phiên, không thuộc tài khoản.
- Đổi sang PA-4 sau này là thay một lớp, nhờ điều khoản 5.

## Challenge

> ⚠️ **Đây là TỰ PHẢN BIỆN, không phải challenger độc lập.** Chủ dự án có chỉ thị
> đứng không gọi AgentTool, nên vòng phản biện bắt buộc của lane SA chưa chạy
> đúng nghĩa. Cùng một cái đầu thì cùng một điểm mù — ghi ra đây để người rà
> soát biết mình đang đọc thứ gì.

| # | Phản biện | Trả lời |
|---|---|---|
| C-1 | Tra CSDL mỗi request phá ngân sách 500 ms của NFR-PER-02 | Không bác được bằng lý lẽ — đã chuyển thành điều kiện đo bắt buộc trong T-00, và điều kiện mở lại ADR |
| C-2 | Gộp ghi 60 giây làm FR-01-07 sai lệch | Thừa nhận, ghi thành hệ quả tiêu cực có số; phương án đúng-từng-giây có sẵn kèm giá của nó |
| C-3 | 200 người dùng đồng thời + Prisma → cạn pool kết nối | SRS §2.3 chạy container có pool cố định, không phải serverless; nhưng kích thước pool là tham số phải đặt tường minh ở T-00 |
| C-4 | Vì sao không PA-2 cho "chuẩn ngành"? | Vì nó vẫn hỏi CSDL, chỉ thưa hơn, mà thêm hẳn một cơ chế; và làm chậm hiệu lực của đổi kho/đổi vai trò |
| C-5 | Mã phiên trong cookie bị đánh cắp thì sao? | Nằm ngoài phạm vi ADR này; thuộc NFR-SEC-05 (OWASP) và cần một quyết định riêng về gắn phiên với thiết bị |

**MY WEAK SPOT:** toàn bộ lập luận hiệu năng của ADR này là phân tích, không có
một phép đo nào. Nếu một điều bị lật, khả năng cao nhất là điều đó.

## Câu hỏi còn treo

- **`docs/adr/` có nên bị gitignore như `docs/specs/` không?** ADR buộc phải nêu
  tham số kiến trúc (thời hạn phiên, cận thu hồi) để có nghĩa. Đây là rò rỉ nhẹ
  hơn shard nhiều, nhưng vẫn là rò rỉ, và nó sẽ lặp lại ở mọi ADR sau. Chưa hỏi.
- OPN-03 quyết xong thì mục "dọn phiên hết hạn" mới chốt được.


---

# Sửa đổi 1 — 2026-08-19: trần 50 ms GỒM chi phí lấy kết nối

## Vì sao phải sửa

WMS-1 đo xong thì lộ ra rằng bản gốc của ADR này viết điều kiện mập mờ: *"mỗi
request cộng thêm một lượt đi CSDL … nếu nó ăn quá 10% ngân sách 500 ms"*. Không
nói rõ "lượt đi" có gồm chi phí **lấy kết nối từ pool** hay không.

Sự mập mờ đó không vô hại. Báo cáo WMS-1 vòng 2 tách chờ pool ra khỏi phán quyết
và kết luận ĐẠT; reviewer R1 chỉ ra rằng **chính việc tách đó** giữ phán quyết ở
ĐẠT, và đo được **riêng chờ pool p95 vượt trần 50 ms ở 2/6 lần chạy** (160 ms và
57 ms). Chủ dự án đã quyết (A4, `docs/pm/decisions.md`):

> **Trần 50 ms áp cho TOÀN BỘ chi phí mà một request phải trả thêm, tính từ lúc
> xin kết nối tới lúc có dữ liệu phiên. Người dùng có chờ lấy kết nối, nên nó là
> chi phí thật.**

## Ba hệ quả

**1. WMS-1 TRƯỢT theo cách đọc đúng và phải đo lại.** Phép đo phải ghi **cặp giá
trị theo từng lượt** (chờ + truy vấn) rồi báo p95 của TỔNG — bản hiện tại chỉ lưu
hai mảng rời nên p95 của tổng không khôi phục được từ bằng chứng.

**2. Kích thước pool không còn là tham số vận hành.** Nó quyết định trực tiếp
việc một yêu cầu ưu tiên M có đạt hay không, nên nó là **quyết định kiến trúc**
và phải chốt TRƯỚC khi WMS-2 dựng lược đồ.

**3. Quy tắc chọn pool — không phải một con số ma thuật.** SRS §2.3 chạy **nhiều
bản sao sau load balancer**, nên ràng buộc thật là ràng buộc TỔNG:

> `số bản sao × kích thước pool + dự phòng quản trị ≤ max_connections`

Container hiện tại có `max_connections = 100`. R1 đã chứng minh mặt trái khi coi
thường ràng buộc này: đặt pool = 100 thì `Promise.all` các `connect()` bị từ chối
một phần, client đã lấy không bao giờ được release, `pool.end()` không bao giờ
resolve — **tiến trình treo vô hạn và chiếm hết kết nối, cả máy không ai vào được
CSDL dev nữa**. Một cấu hình sai ở đây không làm hệ thống chậm, nó làm hệ thống
chết.

## Quyết định tạm về kích thước pool

🟡 **PROVISIONAL 2026-08-19 — pending acceptance.** Máy đặt tạm **pool = 20 cho
mỗi bản sao, tối đa 3 bản sao** (60 kết nối + 40 dự phòng trên `max_connections`
100). Cơ sở: đây là cấu hình mà WMS-1 đã đo thật, không phải con số nghĩ ra.

**Điều kiện xác nhận:** WMS-1 (đo lại) phải cho **p95 của TỔNG chờ + truy vấn ≤
50 ms** ở cấu hình này, đo qua nhiều lần lặp và lấy lần xấu nhất. Không đạt thì
hoặc tăng `max_connections` (phụ thuộc **OPN-03**, vì hạ tầng quyết định con số
đó), hoặc giảm số bản sao, hoặc quay lại PA-4 (Redis) — và khi đó Redis không còn
là "thêm hạ tầng cho vui" mà là cách duy nhất đạt yêu cầu.

**Vì sao đây chỉ là tạm:** `max_connections = 100` là **mặc định của image
`postgres:17-alpine`**, chưa phải cấu hình đã chốt của môi trường chạy thật — mà
môi trường chạy thật còn chờ OPN-03. Con số bản sao cũng chưa ai quyết. Hai ẩn số
đó đóng lại thì quy tắc ở trên mới ra được một con số cuối cùng.

## Cập nhật mục Hệ quả tiêu cực của bản gốc

Gạch đầu dòng *"Mỗi request cộng thêm một lượt đi CSDL"* nay đọc là: **chi phí đó
gồm cả thời gian chờ lấy kết nối**, và ở tải 200 người đồng thời thì **thời gian
chờ pool là thành phần LỚN HƠN chi phí truy vấn vài lần** (WMS-1 đo: truy vấn p95
~2 ms, chờ pool p95 10–18 ms ở lần chạy bình thường). Tối ưu truy vấn không giải
quyết được gì; chỉnh pool mới giải quyết.
