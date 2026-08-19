// Quy tắc nghiệp vụ tồn kho — SRD §7.
// Đây là house of record duy nhất cho công thức tồn khả dụng: BRULE-11 yêu cầu
// "áp dụng nhất quán ở mọi màn hình và mọi API", nên KHÔNG được tính lại tại
// chỗ khác trong codebase.
import { Prisma } from '@/generated/prisma/client'

const { Decimal } = Prisma

/** Các cột số lượng của một dòng SoDuTonKho (SRS §5.2.1). */
export type CotSoLuong = {
  soLuongThucTe: Prisma.Decimal
  soLuongPhanBo: Prisma.Decimal
  soLuongChoQc: Prisma.Decimal
  soLuongCachLy: Prisma.Decimal
  soLuongKhoa: Prisma.Decimal
}

/**
 * BRULE-11 — Tồn khả dụng = Tồn thực tế − Tồn đã phân bổ − Tồn chờ kiểm tra
 * − Tồn cách ly − Tồn khóa do quá hạn.
 */
export function tinhTonKhaDung(c: CotSoLuong): Prisma.Decimal {
  return new Decimal(c.soLuongThucTe)
    .minus(c.soLuongPhanBo)
    .minus(c.soLuongChoQc)
    .minus(c.soLuongCachLy)
    .minus(c.soLuongKhoa)
}

/**
 * BRULE-12 — Tồn kho tại một vị trí không được phép âm ở bất kỳ thời điểm nào.
 * Trả về tên các cột đang âm; rỗng nghĩa là hợp lệ.
 */
export function cotAmViPhamBrule12(c: CotSoLuong): (keyof CotSoLuong)[] {
  return (Object.keys(c) as (keyof CotSoLuong)[]).filter((k) =>
    new Decimal(c[k]).isNegative(),
  )
}

export class ViPhamTonAmError extends Error {
  constructor(readonly cot: (keyof CotSoLuong)[]) {
    super(`BRULE-12: tồn kho không được âm — cột vi phạm: ${cot.join(', ')}`)
    this.name = 'ViPhamTonAmError'
  }
}

/** Chặn giao dịch làm tồn âm (BRULE-12). Ném lỗi thay vì ghi dữ liệu sai. */
export function chanTonAm(c: CotSoLuong): void {
  const cot = cotAmViPhamBrule12(c)
  if (cot.length > 0) throw new ViPhamTonAmError(cot)
}
