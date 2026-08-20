# ADR-0002 — Phiên đăng nhập lưu phía máy chủ, thu hồi quyền tức thời

- **Trạng thái:** **Proposed** — chấp nhận là quyền của chủ dự án (buổi rà soát)
- **Ngày:** 19/08/2026
- **Bối cảnh tài liệu:** SRS §2.3, §4.1 (FR-01-06, FR-01-07), §7.1 (NFR-PER-02,
  NFR-PER-05), §7.3 (NFR-SEC-01, NFR-SEC-04, NFR-SEC-08); SRD BR-22; ADR-0001
- **Luật ghi chép — nói cho đúng thứ tài liệu này thật sự làm:** nó tham chiếu
  bằng MÃ yêu cầu và **có tóm tắt nội dung yêu cầu ở mức đủ để hiểu quyết định**
  (bảng §Bối cảnh), chứ không chép nguyên văn câu nào từ SRS. Nói "chỉ tham chiếu
  bằng mã" là mô tả sai chính nó: một ADR không nêu được lực kéo thì vô dụng.
  G-05 (2026-08-19) đã cân nhắc đúng điều này khi cho phép giữ `docs/adr/` trong
  repo public. (Bản thân việc `docs/adr/` vẫn nằm trong repo public là
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
