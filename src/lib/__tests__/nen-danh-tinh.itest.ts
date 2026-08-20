// WMS-2 — kiểm tiêu chí chấp nhận của nền danh tính TRÊN CSDL THẬT.
//
// Vì sao là test tích hợp chứ không phải unit test: mọi thứ dưới đây là ràng buộc
// Ở CẤP CƠ SỞ DỮ LIỆU (DI-01 nói rõ như vậy), và một unit test mock lại CSDL thì
// chỉ chứng minh cái mock hành xử đúng. Trigger, CHECK constraint và khoá ngoại
// chỉ có nghĩa khi chạy thật.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'

const url = process.env.DATABASE_URL
let db: Client

beforeAll(async () => {
  if (!url) throw new Error('DATABASE_URL chưa cấu hình — xem .env.example')
  db = new Client({ connectionString: url })
  await db.connect()
})
afterAll(async () => { await db?.end() })

/** Chạy một câu lệnh và trả về mã lỗi SQLSTATE, hoặc null nếu nó KHÔNG lỗi. */
async function maLoiCua(sql: string, tham: unknown[] = []): Promise<string | null> {
  try {
    await db.query('BEGIN')
    await db.query(sql, tham)
    await db.query('ROLLBACK')
    return null
  } catch (e) {
    await db.query('ROLLBACK')
    return (e as { code?: string }).code ?? 'KHONG_CO_MA'
  }
}

describe('WMS-2 · AC1 — NguoiDung n–n VaiTro và n–n Kho', () => {
  it('một người dùng gắn được nhiều vai trò và nhiều kho, và ngược lại', async () => {
    const { rows } = await db.query(`
      SELECT
        (SELECT count(*) FROM information_schema.table_constraints
          WHERE table_name = 'nguoi_dung_vai_tro' AND constraint_type = 'PRIMARY KEY')::int AS pk_vt,
        (SELECT count(*) FROM information_schema.key_column_usage
          WHERE table_name = 'nguoi_dung_vai_tro'
            AND constraint_name = (SELECT constraint_name FROM information_schema.table_constraints
              WHERE table_name = 'nguoi_dung_vai_tro' AND constraint_type = 'PRIMARY KEY'))::int AS cot_pk_vt,
        (SELECT count(*) FROM information_schema.key_column_usage
          WHERE table_name = 'nguoi_dung_kho'
            AND constraint_name = (SELECT constraint_name FROM information_schema.table_constraints
              WHERE table_name = 'nguoi_dung_kho' AND constraint_type = 'PRIMARY KEY'))::int AS cot_pk_kho
    `)
    // Khoá chính GỒM HAI CỘT chính là thứ làm nên quan hệ n–n: một người dùng
    // xuất hiện nhiều lần với vai trò khác nhau, và ngược lại.
    expect(rows[0].pk_vt).toBe(1)
    expect(rows[0].cot_pk_vt).toBe(2)
    expect(rows[0].cot_pk_kho).toBe(2)
  })
})

describe('WMS-2 · AC2 — NFR-SEC-03: không cột nào chứa mật khẩu đọc được', () => {
  it('nguoi_dung chỉ có đúng một cột liên quan mật khẩu là băm', async () => {
    const { rows } = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'nguoi_dung' AND column_name ILIKE '%mat_khau%'
      ORDER BY column_name
    `)
    const ten = rows.map((r) => r.column_name)
    expect(ten).toContain('mat_khau_hash')
    // Bất kỳ cột nào tên kiểu mat_khau / mat_khau_ma_hoa / mat_khau_cu đều là cờ
    // đỏ: NFR-SEC-03 cấm lưu dạng rõ LẪN mã hoá hai chiều.
    const dangNgo = ten.filter((n: string) => n !== 'mat_khau_hash' && n !== 'mat_khau_doi_luc')
    expect(dangNgo).toEqual([])
  })
})

describe('WMS-2 · AC3 — SRS §8: 9 vai trò mặc định tồn tại sau migration', () => {
  it('đủ 9 mã vai trò, tất cả đánh dấu la_mac_dinh', async () => {
    const { rows } = await db.query(
      `SELECT ma FROM vai_tro WHERE la_mac_dinh ORDER BY ma`)
    expect(rows.map((r) => r.ma)).toEqual(
      ['CSKH', 'KD', 'KT', 'MH', 'NVK', 'QC', 'QLK', 'QTHT', 'TK'])
  })

  it('danh mục quyền là 20 màn hình × 6 hành động = 120 dòng', async () => {
    const { rows } = await db.query(`SELECT count(*)::int n FROM quyen`)
    expect(rows[0].n).toBe(120)
  })

  it('CHƯA vai trò nào được gắn quyền — cố ý, xem migration.sql', async () => {
    // Đây KHÔNG phải mong muốn vận hành, mà là ghi nhận một quyết định: ma trận
    // gắn quyền ở SRS §8 là nội dung spec, Q3+Q4 giữ nó ngoài repo public.
    // Test này tồn tại để khi ai đó seed ma trận vào, họ buộc phải đọc lý do.
    const { rows } = await db.query(`SELECT count(*)::int n FROM vai_tro_quyen`)
    expect(rows[0].n).toBe(0)
  })
})

describe('WMS-2 · AC4 — BRULE-13 / DI-07: nhật ký chỉ ghi thêm', () => {
  /**
   * Dựng một bản ghi thật rồi mới thử sửa/xoá nó, trong một transaction bị
   * ROLLBACK ở cuối. Vòng chạy đầu tiên của test này ĐỎ vì lý do đáng giá: bảng
   * rỗng thì trigger FOR EACH ROW không bắn, nên "UPDATE bị từ chối" xanh giả.
   * Một test chỉ có nghĩa khi có dòng để mà chặn.
   */
  async function thuTrenMotDongThat(sql: string): Promise<string | null> {
    await db.query('BEGIN')
    try {
      await db.query(`INSERT INTO kho (ma, ten) VALUES ('K-AC4', 'Kho kiểm thử AC4')`)
      const { rows: nd } = await db.query(
        `INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
         VALUES ('ac4', 'ac4@noi-bo', 'Kiểm thử AC4', '$argon2id$gia-lap') RETURNING id`)
      await db.query(
        `INSERT INTO nhat_ky_thao_tac
           (nguoi_dung_id, ten_dang_nhap_luc_ghi, hanh_dong, loai_doi_tuong, dia_chi_ip)
         VALUES ($1, 'ac4', 'DANG_NHAP', 'NguoiDung', '10.0.0.9')`, [nd[0].id])
      await db.query(
        `INSERT INTO chuyen_dong_kho
           (loai_giao_dich, san_pham_id, kho_id, vi_tri_id, so_luong, ton_truoc, ton_sau,
            loai_chung_tu, chung_tu_id, nguoi_thuc_hien_id, thoi_diem)
         VALUES ('NHAP', 1, 1, 1, 5, 10, 15, 'PhieuNhapKho', 1, $1, now())`, [nd[0].id])
      await db.query(sql)
      await db.query('ROLLBACK')
      return null
    } catch (e) {
      await db.query('ROLLBACK')
      return (e as { code?: string }).code ?? 'KHONG_CO_MA'
    }
  }

  it('UPDATE một dòng nhật ký ĐANG TỒN TẠI bị chặn', async () => {
    expect(await thuTrenMotDongThat(`UPDATE nhat_ky_thao_tac SET hanh_dong = 'X'`))
      .toBe('23001')   // restrict_violation, do trigger chan_sua_xoa nâng lên
  })

  it('DELETE một dòng nhật ký ĐANG TỒN TẠI bị chặn', async () => {
    expect(await thuTrenMotDongThat(`DELETE FROM nhat_ky_thao_tac`)).toBe('23001')
  })

  it('UPDATE và DELETE trên chuyen_dong_kho cũng bị chặn (BRULE-13)', async () => {
    expect(await thuTrenMotDongThat(`UPDATE chuyen_dong_kho SET so_luong = 0`)).toBe('23001')
    expect(await thuTrenMotDongThat(`DELETE FROM chuyen_dong_kho`)).toBe('23001')
  })

  it('INSERT thì KHÔNG bị chặn — cặp biên của "chỉ ghi thêm"', async () => {
    // thuTrenMotDongThat tự INSERT 1 dòng nhật ký; câu SQL truyền vào chỉ đọc.
    expect(await thuTrenMotDongThat(`SELECT 1`)).toBeNull()
  })
})

describe('WMS-2 · DI-01 / BRULE-12 — tồn không âm, cưỡng chế ở cấp CSDL', () => {
  it('INSERT số lượng âm vào so_du_ton_kho bị CHECK constraint chặn', async () => {
    const ma = await maLoiCua(`
      INSERT INTO so_du_ton_kho
        (san_pham_id, kho_id, vi_tri_id, so_luong_thuc_te, so_luong_cho_qc,
         so_luong_cach_ly, so_luong_khoa, so_luong_kha_dung)
      VALUES (1, 1, 1, -1, 0, 0, 0, 0)`)
    expect(ma).toBe('23514')   // check_violation
  })

  it('số lượng bằng 0 thì hợp lệ — cặp biên của "không âm"', async () => {
    const ma = await maLoiCua(`
      INSERT INTO so_du_ton_kho
        (san_pham_id, kho_id, vi_tri_id, so_luong_thuc_te, so_luong_cho_qc,
         so_luong_cach_ly, so_luong_khoa, so_luong_kha_dung)
      VALUES (1, 1, 1, 0, 0, 0, 0, 0)`)
    expect(ma).toBeNull()
  })
})

describe('WMS-2 · DI-02 — ton_sau trừ ton_truoc phải bằng so_luong', () => {
  const chungTu = (truoc: number, sau: number, sl: number) => `
    INSERT INTO chuyen_dong_kho
      (loai_giao_dich, san_pham_id, kho_id, vi_tri_id, so_luong, ton_truoc, ton_sau,
       loai_chung_tu, chung_tu_id, nguoi_thuc_hien_id, thoi_diem)
    VALUES ('NHAP', 1, 1, 1, ${sl}, ${truoc}, ${sau}, 'PhieuNhapKho', 1, 1, now())`

  it('lệch một đơn vị là bị chặn', async () => {
    expect(await maLoiCua(chungTu(10, 15, 4))).toBe('23514')
  })

  it('khớp thì đi qua — cặp biên', async () => {
    expect(await maLoiCua(chungTu(10, 15, 5))).toBeNull()
  })
})
