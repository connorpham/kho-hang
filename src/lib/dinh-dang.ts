// DC-06 — Định dạng ngày hiển thị dd/MM/yyyy; số dùng dấu chấm phân cách hàng
// nghìn và dấu phẩy phân cách thập phân; múi giờ hệ thống là UTC+7.
// Mọi chỗ hiển thị ngày/số phải đi qua đây, không tự gọi toLocaleString.

/** Múi giờ hệ thống theo DC-06. Server có thể chạy UTC nên phải nêu tường minh. */
export const MUI_GIO_HE_THONG = 'Asia/Ho_Chi_Minh'

const LOCALE = 'vi-VN'

/** dd/MM/yyyy theo UTC+7. */
export function dinhDangNgay(d: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: MUI_GIO_HE_THONG,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/**
 * dd/MM/yyyy HH:mm theo UTC+7 — dùng cho nhật ký và dấu thời gian chuyển động.
 * Ghép tường minh từ các thành phần: locale vi-VN xếp GIỜ TRƯỚC NGÀY
 * ("00:30 19/08/2026"), trái với thứ tự DC-06 quy định.
 */
export function dinhDangNgayGio(d: Date): string {
  const phan = new Intl.DateTimeFormat(LOCALE, {
    timeZone: MUI_GIO_HE_THONG,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)

  const lay = (loai: Intl.DateTimeFormatPartTypes) =>
    phan.find((p) => p.type === loai)?.value ?? ''

  return `${lay('day')}/${lay('month')}/${lay('year')} ${lay('hour')}:${lay('minute')}`
}

/**
 * Số lượng tồn kho: DECIMAL(18,3) trong DB (SRS §5.2.1) nên hiển thị tối đa 3
 * chữ số thập phân. Nhận string để không mất chính xác khi đi qua float.
 */
export function dinhDangSoLuong(v: string | number, soLeToiDa = 3): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: soLeToiDa,
  }).format(typeof v === 'string' ? Number(v) : v)
}
