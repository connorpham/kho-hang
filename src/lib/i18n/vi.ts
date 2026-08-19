// DC-03 — "Toàn bộ chuỗi ký tự hiển thị phải được tách khỏi mã nguồn để phục vụ
// đa ngôn ngữ ở giai đoạn sau; mặc định Giai đoạn 1 chỉ có tiếng Việt."
// Ràng buộc này áp dụng từ dòng code đầu tiên: KHÔNG hardcode chuỗi hiển thị
// trong component. Khi thêm ngôn ngữ, tạo file song song và chọn theo locale.
export const vi = {
  app: {
    ten: 'StockFlow WMS',
    moTa: 'Hệ thống Quản lý Kho Phân phối B2B — Công ty CP Phân phối Trường Phát',
  },
  base: {
    tieuDe: 'Nền dự án đã sẵn sàng',
    ghiChu:
      'Chưa có màn hình nghiệp vụ nào được cài đặt. Phạm vi Giai đoạn 1 là 20 màn hình SC-01…SC-20 theo SRS.',
    nhanTienDo: 'Màn hình đã cài đặt',
  },
} as const

export type BangChuoi = typeof vi
