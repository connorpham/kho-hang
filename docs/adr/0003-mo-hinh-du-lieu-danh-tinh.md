# ADR-0003 — Mô hình dữ liệu danh tính: NguoiDung, VaiTro, Quyen, Kho, Phien

- **Trạng thái:** **Proposed** — chấp nhận là quyền của chủ dự án
- **Ngày:** 20/08/2026
- **Bối cảnh tài liệu:** SRS §5.1 (danh sách thực thể), §5.3 (DI-07), §8 (ma trận
  phân quyền); FR-20-01, FR-20-02, FR-20-09; FR-06-01, FR-06-02; SC-01 FR-01-01…08;
  SRD BR-22; ADR-0001, ADR-0002
- **Ticket:** WMS-2

## Vì sao cần một ADR mới cho một việc nghe như "tạo mấy cái bảng"

`prisma/schema.prisma` mở đầu bằng đúng một luật: *"SRS §5.1 liệt kê 36 thực thể;
34 thực thể còn lại CHƯA có đặc tả cột nên KHÔNG được mô hình hoá ở đây — chúng
thuộc phần việc của SA/BA (ADR + shard spec) để tránh tự phát minh cấu trúc dữ
liệu."* WMS-2 yêu cầu mô hình hoá 4 trong số 34 thực thể đó, nên nó **không thể
được làm mà không có ADR** — làm thẳng là vi phạm luật do chính base này đặt ra.

Kiểm tra thực tế: **SRS §5.2 chỉ đặc tả tới từng cột cho ba thực thể** —
`SoDuTonKho` (§5.2.1), `ChuyenDongKho` (§5.2.2), `SerialItem` (§5.2.3). Không có
`NguoiDung`, `VaiTro`, `Kho`. Vậy câu hỏi kiến trúc thật sự là: **suy ra cột từ
đâu, và chỗ nào buộc phải đoán thì đoán tối thiểu tới mức nào.**

## Quyết định

**Mỗi cột trong ADR này phải truy được về một yêu cầu. Chỗ nào không truy được thì
KHÔNG có cột.** Không có cột "cho chắc", không có `metadata jsonb`, không có cột
dự phòng cho tính năng chưa ai yêu cầu.

### Nguồn suy ra của từng thực thể

| Thực thể | Suy ra từ | Mức chắc chắn |
|---|---|---|
| `Phien` | **ADR-0002 §Quyết định 1 liệt kê thẳng các cột** | Cao — đã được đặc tả |
| `NguoiDung` | FR-01-01 (tên đăng nhập **hoặc** email nội bộ), FR-01-02 (khoá tạm sau 5 lần sai trong 15 phút), FR-01-04 (đổi mật khẩu lần đầu + định kỳ 90 ngày), NFR-SEC-03 (chỉ lưu băm), FR-20-01 (tạo/sửa/**vô hiệu hoá**), NFR-SEC-08 (vô hiệu hoá có hiệu lực ≤2 phút — ADR-0002 đọc cờ này mỗi request) | Cao |
| `VaiTro` + `Quyen` | FR-20-02 (ma trận quyền **theo từng màn hình và từng hành động**: Xem, Tạo, Sửa, Xóa, Phê duyệt, Kết xuất), §8 (9 vai trò mặc định), FR-20-03 (vai trò mẫu, sao chép được) | Cao |
| `Kho` | **Chỉ có một dòng ở §5.1** ("Kho vật lý, 1–n với ViTri") + BR-22 (phạm vi kho) | **THẤP — xem §Chỗ phải đoán** |
| `NhatKyThaoTac` | FR-20-09 (người thực hiện, thời điểm, IP, đối tượng, giá trị trước/sau), FR-01-08, DI-07 | Cao |

### Chỗ phải đoán, và đoán tối thiểu tới mức nào

**`Kho` chỉ được có 4 cột: `id`, `ma`, `ten`, `dangHoatDong`.** Không địa chỉ,
không toạ độ, không loại kho, không giờ làm việc — SRS không yêu cầu cái nào.
WMS-2 cần `Kho` **chỉ để làm đích cho phạm vi kho của BR-22**; cấu trúc kho bốn
cấp (Kho → Khu vực → Kệ → Ô chứa) và mã vị trí là **việc của SC-06** và còn đang
chờ **TBD-01**. Thêm cột bây giờ là phát minh, và tệ hơn: nó sẽ va vào thiết kế
thật của SC-06.

`ViTri` **không** được tạo trong WMS-2, dù §5.1 có nó — không AC nào của WMS-2
chạm tới nó.

### Ba lựa chọn kiến trúc, không phải chi tiết cài đặt

**1. Ma trận quyền: bảng `Quyen` (màn hình × hành động), KHÔNG phải enum.**
FR-20-02 bắt quản trị **định nghĩa vai trò tuỳ chỉnh** lúc chạy. Enum trong DB thì
mỗi lần thêm màn hình là một migration; bảng lookup thì không. Đây đúng luật "danh
mục người dùng quản lý = lookup table" trong `docs/team/roles/ba.md`.

**2. `NhatKyThaoTac` chỉ ghi thêm, cưỡng chế bằng REVOKE ở cấp CSDL** — cùng cơ
chế BRULE-13 đang dùng cho `chuyen_dong_kho`. Lý do: ST-15 (kiểm toán nội bộ) cần
truy vết được **mọi** thay đổi tồn kho theo người/thời gian/lý do, và PB-07 nói
hiện trạng không có gì để lần. Một nhật ký sửa được thì không phải nhật ký.

**3. Nhật ký giữ `ten_dang_nhap_luc_ghi` bên cạnh khoá ngoại `nguoi_dung_id`.**
Đổi tên đăng nhập sau này **không được viết lại lịch sử** (luật "dữ liệu lịch sử
là bất biến" trong bảng kiểm tra dữ liệu của BA). Khoá ngoại trả lời "ai", chuỗi
lưu kèm trả lời "lúc đó họ tên gì".

## Hệ quả

### Tiêu cực

- **Thêm 6 bảng mà SRS không đặc tả cột.** Nếu SRS v1.1 sau này đặc tả khác đi thì
  phải migration lại. Giảm thiểu bằng cách giữ số cột ở mức tối thiểu truy được.
- **`Kho` gần như chắc chắn sẽ phải mở rộng ở SC-06.** Đây là nợ có chủ ý, ghi ở
  đây để lúc đó không ai coi là phát hiện mới.
- **Không có bảng lịch sử mật khẩu**, dù ràng buộc SC-01 cấm tái dùng 5 mật khẩu
  gần nhất — việc đó thuộc **S-04 (sprint-2)**. WMS-2 để lại chỗ trống có chủ ý,
  không phải bỏ sót.
- **Không có cột TOTP.** FR-01-05 bắt buộc 2FA cho QTHT/QLK, nhưng **G-02 chưa
  trả lời** (mất thiết bị thì khôi phục đường nào) và cách khôi phục quyết định
  mô hình dữ liệu. Thêm cột trước khi biết là đoán.
- **Migration đầu tiên phải viết SQL thủ công**: Prisma không sinh được CHECK
  constraint (DI-01/BRULE-12) và không quản lý được GRANT/REVOKE (BRULE-13).
  Vì vậy cần `SHADOW_DATABASE_URL`, đã có trong `.env.example`.

### Tích cực

- ADR-0002 thi hành được: `Phien` join `NguoiDung.dang_hoat_dong` trong một lượt
  đọc ⇒ thu hồi quyền **0 phút** thay vì cận 2 phút của NFR-SEC-08.
- BR-22 cưỡng chế được ở tầng máy chủ: `NguoiDung n–n Kho` là dữ liệu, không phải
  quy ước.
- Viên gạch đầu tiên của sổ kiểm toán mà PB-07 và ST-15 đang thiếu.

## Điều ADR này KHÔNG quyết

- Phân vùng bảng theo tháng — chờ **OPN-03**.
- Cấu trúc kho bốn cấp và quy tắc sinh mã vị trí — **SC-06** + **TBD-01**.
- Đường khôi phục TOTP — **G-02**.
- Kích thước pool đã chốt ở **ADR-0002 Sửa đổi 1** (20/bản sao, tối đa 3), WMS-2
  chỉ có nhiệm vụ **đặt nó tường minh**, không quyết lại.

## Challenge

Vòng review 3 người của WMS-2 (diff chạm `prisma/schema.prisma` và
`prisma/migrations/`, đều nằm trong `review.high_stakes_paths`) đóng vai challenger
cho ADR này — cùng một diff, cùng một lúc. Kết quả ghi ở `evd/WMS-2/dev/review.md`.
