import { describe, expect, it } from 'vitest'
import { Prisma } from '@/generated/prisma/client'
import {
  ViPhamTonAmError,
  chanTonAm,
  cotAmViPhamBrule12,
  tinhTonKhaDung,
  type CotSoLuong,
} from '../ton-kho'

const { Decimal } = Prisma
const d = (v: string) => new Decimal(v)

const cot = (o: Partial<Record<keyof CotSoLuong, string>> = {}): CotSoLuong => ({
  soLuongThucTe: d(o.soLuongThucTe ?? '0'),
  soLuongPhanBo: d(o.soLuongPhanBo ?? '0'),
  soLuongChoQc: d(o.soLuongChoQc ?? '0'),
  soLuongCachLy: d(o.soLuongCachLy ?? '0'),
  soLuongKhoa: d(o.soLuongKhoa ?? '0'),
})

describe('BRULE-11 — tồn khả dụng', () => {
  it('trừ đủ cả 4 thành phần khỏi tồn thực tế', () => {
    const kq = tinhTonKhaDung(
      cot({
        soLuongThucTe: '100',
        soLuongPhanBo: '10',
        soLuongChoQc: '5',
        soLuongCachLy: '3',
        soLuongKhoa: '2',
      }),
    )
    expect(kq.toString()).toBe('80')
  })

  it('không tính tồn chờ QC vào khả dụng (FR-08-09)', () => {
    const kq = tinhTonKhaDung(cot({ soLuongThucTe: '50', soLuongChoQc: '50' }))
    expect(kq.toString()).toBe('0')
  })

  it('loại tồn đã phân bổ khỏi khả dụng ngay (FR-10-07)', () => {
    const kq = tinhTonKhaDung(cot({ soLuongThucTe: '20', soLuongPhanBo: '20' }))
    expect(kq.toString()).toBe('0')
  })

  it('giữ chính xác 3 chữ số thập phân, không sai số float', () => {
    // 0.1 + 0.2 kiểu float cho 0.30000000000000004 — Decimal phải cho 0.7.
    const kq = tinhTonKhaDung(
      cot({ soLuongThucTe: '1', soLuongPhanBo: '0.1', soLuongChoQc: '0.2' }),
    )
    expect(kq.toString()).toBe('0.7')
  })

  it('trả về số âm khi các cột giữ vượt tồn thực tế — dấu hiệu dữ liệu lệch', () => {
    const kq = tinhTonKhaDung(cot({ soLuongThucTe: '5', soLuongPhanBo: '9' }))
    expect(kq.isNegative()).toBe(true)
  })
})

describe('BRULE-12 — tồn không được âm', () => {
  it('chấp nhận mọi cột bằng 0', () => {
    expect(cotAmViPhamBrule12(cot())).toEqual([])
    expect(() => chanTonAm(cot())).not.toThrow()
  })

  it('chỉ ra đúng các cột đang âm', () => {
    const vp = cotAmViPhamBrule12(
      cot({ soLuongThucTe: '-1', soLuongCachLy: '-0.001' }),
    )
    expect(vp).toEqual(['soLuongThucTe', 'soLuongCachLy'])
  })

  it('chặn giao dịch làm tồn âm bằng ViPhamTonAmError', () => {
    expect(() => chanTonAm(cot({ soLuongThucTe: '-1' }))).toThrow(ViPhamTonAmError)
  })
})
