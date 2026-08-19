import { describe, expect, it } from 'vitest'
import { dinhDangNgay, dinhDangNgayGio, dinhDangSoLuong } from '../dinh-dang'

describe('DC-06 — định dạng ngày', () => {
  it('hiển thị dd/MM/yyyy, có số 0 đứng đầu', () => {
    expect(dinhDangNgay(new Date('2026-08-19T03:00:00Z'))).toBe('19/08/2026')
  })

  it('quy đổi sang UTC+7 chứ không dùng UTC — 17:30Z ngày 18 là ngày 19 tại VN', () => {
    expect(dinhDangNgay(new Date('2026-08-18T17:30:00Z'))).toBe('19/08/2026')
  })

  it('ngày giờ dùng đồng hồ 24h', () => {
    expect(dinhDangNgayGio(new Date('2026-08-18T17:30:00Z'))).toBe('19/08/2026 00:30')
  })
})

describe('DC-06 — định dạng số', () => {
  it('dấu chấm phân cách hàng nghìn', () => {
    expect(dinhDangSoLuong('1234567')).toBe('1.234.567')
  })

  it('dấu phẩy phân cách thập phân', () => {
    expect(dinhDangSoLuong('1234.5')).toBe('1.234,5')
  })

  it('giữ tối đa 3 chữ số thập phân theo DECIMAL(18,3)', () => {
    expect(dinhDangSoLuong('10.125')).toBe('10,125')
  })

  it('không thêm số 0 vô nghĩa khi là số nguyên', () => {
    expect(dinhDangSoLuong('42')).toBe('42')
  })
})
