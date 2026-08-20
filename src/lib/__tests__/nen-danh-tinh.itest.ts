// WMS-2 — kiểm tiêu chí chấp nhận của nền danh tính TRÊN CSDL THẬT.
//
// LẦN VIẾT THỨ HAI. Bản đầu bị reviewer R3 phá bằng 8 phép đột biến, 6 phép để
// nguyên 13/13 xanh: xoá hai bảng nối thay bằng bảng rác vẫn xanh; ép quan hệ về
// 1–n vẫn xanh; nhét mật khẩu RÕ vào mat_khau_hash vẫn xanh; thu hẹp CHECK từ 6
// cột còn 1 vẫn xanh. Nguyên nhân chung: bản đầu kiểm SIÊU DỮ LIỆU (đếm cột,
// đếm dòng) rồi dán nhãn HÀNH VI lên kết quả.
//
// Bản này kiểm hành vi: làm thật rồi xem CSDL có chặn không.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'

let db: Client

beforeAll(async () => {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL chưa cấu hình — xem .env.example')
  db = new Client({ connectionString: url })
  await db.connect()

  // CHỐT AN TOÀN (R3-F7). Bộ test này chạy DELETE và UPDATE không WHERE. Chúng
  // nằm trong transaction bị rollback, nhưng "hôm nay vô hại" không phải một bảo
  // đảm. Nếu DATABASE_URL lỡ trỏ vào CSDL thật thì phải dừng ở đây.
  const { rows } = await db.query('SELECT current_database() db, version() v')
  if (!/^(stockflow_wms|wms2_.*|.*_test)$/.test(rows[0].db)) {
    throw new Error(`từ chối chạy trên CSDL "${rows[0].db}" — bộ test này chạy DML `
      + 'không WHERE. Chỉ chấp nhận stockflow_wms hoặc CSDL tên *_test / wms2_*.')
  }
  // In ra server đang nói chuyện. Hai PostgreSQL cùng đòi cổng 5432 đã từng làm
  // cả migration lẫn test chạy nhầm server suốt một phiên mà không ai biết.
  console.log(`  [itest] ${rows[0].v.split(' on ')[0]} · ${rows[0].db}`)
})
afterAll(async () => { await db?.end() })

/**
 * Trả `mã SQLSTATE + tên ràng buộc`, hoặc null nếu không lỗi.
 *
 * Vì sao cần tên chứ không chỉ mã: phép đột biến của chính tác giả cho thấy hai
 * test khoá ngoại XANH VÌ LÝ DO SAI — gỡ `chuyen_dong_kho_kho_id_fkey` thì câu
 * INSERT vẫn 23503, chỉ là do khoá ngoại KHÁC (`nguoi_thuc_hien_id`) bắt. Mã lỗi
 * giống nhau nên test không phân biệt được. Cùng lý do với 23514: bảng có ba
 * CHECK, khẳng định trần "23514" không nói được cái nào đã chặn.
 */
async function thuRB(sql: string, tham: unknown[] = []): Promise<string | null> {
  await db.query('BEGIN')
  try {
    await db.query(sql, tham)
    await db.query('ROLLBACK')
    return null
  } catch (e) {
    await db.query('ROLLBACK')
    const x = e as { code?: string; constraint?: string }
    return `${x.code ?? 'KHONG_CO_MA'}:${x.constraint ?? 'khong-ro'}`
  }
}

/** Chạy trong transaction rồi ROLLBACK. Trả mã SQLSTATE, hoặc null nếu không lỗi. */
async function thu(sql: string, tham: unknown[] = []): Promise<string | null> {
  await db.query('BEGIN')
  try {
    await db.query(sql, tham)
    await db.query('ROLLBACK')
    return null
  } catch (e) {
    await db.query('ROLLBACK')
    return (e as { code?: string }).code ?? 'KHONG_CO_MA'
  }
}

/**
 * Dựng dữ liệu mồi rồi chạy `sql`. Lỗi ở bước DỰNG được ném thẳng ra ngoài, KHÔNG
 * bị nuốt thành mã trả về — R3-F4: bản đầu gộp cả hai vào một try, nên khi nhật ký
 * hỏng tới mức không INSERT được thì ba test "bị chặn" vẫn xanh.
 */
async function voiDuLieuMoi<T>(viec: (id: bigint) => Promise<T>): Promise<T> {
  await db.query('BEGIN')
  try {
    const { rows: k } = await db.query(
      `INSERT INTO kho (ma, ten) VALUES ('K-IT', 'Kho kiểm thử') RETURNING id`)
    const { rows: n } = await db.query(
      `INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
       VALUES ('itest', 'itest@noi-bo', 'Kiểm thử', '$argon2id$v=19$gia-lap')
       RETURNING id`)
    await db.query(
      `INSERT INTO nhat_ky_thao_tac
         (nguoi_dung_id, ten_dang_nhap_luc_ghi, hanh_dong, loai_doi_tuong, dia_chi_ip)
       VALUES ($1, 'itest', 'DANG_NHAP', 'NguoiDung', '10.0.0.9')`, [n[0].id])
    await db.query(
      `INSERT INTO chuyen_dong_kho
         (loai_giao_dich, san_pham_id, kho_id, vi_tri_id, so_luong, ton_truoc, ton_sau,
          loai_chung_tu, chung_tu_id, nguoi_thuc_hien_id, thoi_diem)
       VALUES ('NHAP', 1, $1, 1, 5, 10, 15, 'PhieuNhapKho', 1, $2, now())`,
      [k[0].id, n[0].id])
    return await viec(n[0].id)
  } finally {
    await db.query('ROLLBACK')
  }
}

describe('WMS-2 · AC1 — NguoiDung n–n VaiTro và n–n Kho (kiểm HÀNH VI)', () => {
  it('một người dùng nhận được NHIỀU vai trò', async () => {
    const ma = await thu(`
      WITH n AS (INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
                 VALUES ('nn1','nn1@x','N','$argon2id$v=19$m=65536,t=3,p=4$Z2lhbGFw$gia-lap') RETURNING id)
      INSERT INTO nguoi_dung_vai_tro (nguoi_dung_id, vai_tro_id)
      SELECT n.id, v.id FROM n CROSS JOIN vai_tro v WHERE v.ma IN ('QLK','TK')`)
    expect(ma).toBeNull()
  })

  it('một vai trò gắn được cho NHIỀU người dùng', async () => {
    const ma = await thu(`
      WITH n AS (INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
                 VALUES ('nn2','nn2@x','N','$argon2id$v=19$m=65536,t=3,p=4$Z2lhbGFw$gia-lap'), ('nn3','nn3@x','N','$argon2id$v=19$m=65536,t=3,p=4$Z2lhbGFw$gia-lap') RETURNING id)
      INSERT INTO nguoi_dung_vai_tro (nguoi_dung_id, vai_tro_id)
      SELECT n.id, v.id FROM n CROSS JOIN vai_tro v WHERE v.ma = 'QLK'`)
    expect(ma).toBeNull()
  })

  it('cặp (người dùng, vai trò) TRÙNG bị chặn — cặp biên của n–n', async () => {
    const ma = await thu(`
      WITH n AS (INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
                 VALUES ('nn4','nn4@x','N','$argon2id$v=19$m=65536,t=3,p=4$Z2lhbGFw$gia-lap') RETURNING id)
      INSERT INTO nguoi_dung_vai_tro (nguoi_dung_id, vai_tro_id)
      SELECT n.id, v.id FROM n CROSS JOIN vai_tro v WHERE v.ma = 'QLK'
      UNION ALL SELECT n.id, v.id FROM n CROSS JOIN vai_tro v WHERE v.ma = 'QLK'`)
    expect(ma).not.toBeNull()
  })

  it('một người dùng thuộc NHIỀU kho — BR-22 là dữ liệu, không phải quy ước', async () => {
    const ma = await thu(`
      WITH k AS (INSERT INTO kho (ma, ten) VALUES ('K1','Kho 1'), ('K2','Kho 2') RETURNING id),
           n AS (INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
                 VALUES ('nn5','nn5@x','N','$argon2id$v=19$m=65536,t=3,p=4$Z2lhbGFw$gia-lap') RETURNING id)
      INSERT INTO nguoi_dung_kho (nguoi_dung_id, kho_id) SELECT n.id, k.id FROM n CROSS JOIN k`)
    expect(ma).toBeNull()
  })
})

describe('WMS-2 · AC2 — NFR-SEC-03: quét bí mật theo DANH SÁCH CHO PHÉP', () => {
  it('không cột chuỗi nào trong schema public mang tên gợi ý bí mật, ngoài tập đã duyệt', async () => {
    // Danh sách CẤM không bắt được cột bí mật TƯƠNG LAI (R3-F2: bi_mat_totp,
    // khoi_phuc_token lọt sạch). Đảo lại: mọi cột chuỗi có tên gợi ý bí mật đều
    // ĐỎ trừ khi nằm trong tập trắng đã duyệt, và tập trắng phải có lý do.
    const CHO_PHEP = new Set(['nguoi_dung.mat_khau_hash'])  // NFR-SEC-03: chỉ băm
    const { rows } = await db.query(`
      SELECT table_name || '.' || column_name AS cot
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type IN ('character varying', 'text', 'character')
        AND column_name ~ '(mat_khau|pass|pwd|secret|bi_mat|token|khoi_phuc)'
      ORDER BY 1`)
    expect(rows.map((r) => r.cot).filter((c: string) => !CHO_PHEP.has(c))).toEqual([])
  })

  // R3 đục thủng bản trước bằng cách nhét chuỗi RÕ vào chính mat_khau_hash: quét
  // tên cột không nói gì về nội dung. Nay CSDL từ chối thứ không phải chuỗi băm.
  it('mật khẩu dạng RÕ bị CSDL từ chối', async () => {
    expect(await thu(
      `INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
       VALUES ('ro','ro@x','Ro','MatKhau@123')`)).toBe('23514')
    expect(await thuRB(
      `INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
       VALUES ('ro2','ro2@x','Ro','MatKhau@123')`))
      .toBe('23514:nguoi_dung_mat_khau_phai_la_bam')
  })

  it.each([
    ['bcrypt', '$2b$12$abcdefghijklmnopqrstuv'],
    ['scrypt', '$scrypt$ln=16,r=8,p=1$c2FsdA$aGFzaA'],
    ['argon2id', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA'],
  ])('băm %s hợp lệ thì đi qua — cặp biên, và NFR-SEC-03 cho phép cả ba', async (_ten, bam) => {
    expect(await thu(
      `INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
       VALUES ('ok','ok@x','Ok', $1)`, [bam])).toBeNull()
  })

  it('tên đăng nhập và email phải DUY NHẤT — FR-01-01 đăng nhập bằng một trong hai', async () => {
    const bam = '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA'
    expect(await thu(
      `INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
       VALUES ('trung','a@x','A',$1), ('trung','b@x','B',$1)`, [bam])).toBe('23505')
    expect(await thu(
      `INSERT INTO nguoi_dung (ten_dang_nhap, email, ho_ten, mat_khau_hash)
       VALUES ('a','trung@x','A',$1), ('b','trung@x','B',$1)`, [bam])).toBe('23505')
  })
})

describe('WMS-2 · DC-06 — mọi cột thời gian phải mang múi giờ', () => {
  // Đây là thuộc tính KIỂU, không phải hành vi, nên phép kiểm siêu dữ liệu mới là
  // công cụ đúng. Không có nó thì một migration sau lén đưa `timestamp` trần trở
  // lại và không ai bắt — R3 đảo ngược 14 cột mà bộ test cũ vẫn xanh nguyên.
  it('không cột nào trong schema public là timestamp KHÔNG múi giờ', async () => {
    const { rows } = await db.query(`
      SELECT table_name || '.' || column_name AS cot
      FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
      ORDER BY 1`)
    expect(rows.map((r) => r.cot)).toEqual([])
  })
})

describe('WMS-2 · SRS §5.2 — khoá ngoại tới Kho và NguoiDung phải thực thi', () => {
  const BAM = '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA'

  it('kho_id không tồn tại bị chặn bởi ĐÚNG khoá ngoại kho', async () => {
    // Người dùng có thật, chỉ kho là giả ⇒ chỉ một khoá ngoại có thể bắt.
    expect(await thuRB(`
      WITH n AS (INSERT INTO nguoi_dung (ten_dang_nhap,email,ho_ten,mat_khau_hash)
                 VALUES ('fk1','fk1@x','N',$1) RETURNING id)
      INSERT INTO chuyen_dong_kho
        (loai_giao_dich, san_pham_id, kho_id, vi_tri_id, so_luong, ton_truoc, ton_sau,
         loai_chung_tu, chung_tu_id, nguoi_thuc_hien_id, thoi_diem)
      SELECT 'NHAP', 1, 999999, 1, 5, 10, 15, 'PhieuNhapKho', 1, n.id, now() FROM n`, [BAM]))
      .toBe('23503:chuyen_dong_kho_kho_id_fkey')
  })

  it('nguoi_thuc_hien_id không tồn tại bị chặn bởi ĐÚNG khoá ngoại người dùng', async () => {
    // Kho có thật, chỉ người dùng là giả ⇒ mirror của test trên.
    expect(await thuRB(`
      WITH k AS (INSERT INTO kho (ma,ten) VALUES ('K-FK2','Kho FK2') RETURNING id)
      INSERT INTO chuyen_dong_kho
        (loai_giao_dich, san_pham_id, kho_id, vi_tri_id, so_luong, ton_truoc, ton_sau,
         loai_chung_tu, chung_tu_id, nguoi_thuc_hien_id, thoi_diem)
      SELECT 'NHAP', 1, k.id, 1, 5, 10, 15, 'PhieuNhapKho', 1, 999999, now() FROM k`))
      .toBe('23503:chuyen_dong_kho_nguoi_thuc_hien_id_fkey')
  })

  it('xoá người dùng còn dấu vết trong SỔ bị chặn — ST-15 cần đọc được "ai làm"', async () => {
    // Hai CÂU LỆNH riêng, không dùng CTE: trong một câu, CTE ghi dữ liệu và câu
    // DELETE cùng nhìn một ảnh chụp, nên DELETE không thấy dòng vừa chèn và xoá 0
    // dòng — test sẽ xanh vì lý do sai. Vòng chạy đầu của chính test này vấp đúng đó.
    // KHÔNG dựng dòng nhật ký: nhật ký cũng có khoá ngoại RESTRICT và sẽ che mất
    // khoá ngoại của sổ. Chỉ dựng đúng thứ đang kiểm.
    await db.query('BEGIN')
    try {
      const { rows: k } = await db.query(
        `INSERT INTO kho (ma,ten) VALUES ('K-FK3','Kho FK3') RETURNING id`)
      const { rows: n } = await db.query(
        `INSERT INTO nguoi_dung (ten_dang_nhap,email,ho_ten,mat_khau_hash)
         VALUES ('fk3','fk3@x','N',$1) RETURNING id`, [BAM])
      await db.query(
        `INSERT INTO chuyen_dong_kho
           (loai_giao_dich, san_pham_id, kho_id, vi_tri_id, so_luong, ton_truoc,
            ton_sau, loai_chung_tu, chung_tu_id, nguoi_thuc_hien_id, thoi_diem)
         VALUES ('NHAP',1,$1,1,5,10,15,'PhieuNhapKho',1,$2,now())`, [k[0].id, n[0].id])
      let ket: string | null = null
      try {
        await db.query(`DELETE FROM nguoi_dung WHERE id = $1`, [n[0].id])
      } catch (e) {
        const x = e as { code?: string; constraint?: string }
        ket = `${x.code}:${x.constraint}`
      }
      expect(ket).toBe('23503:chuyen_dong_kho_nguoi_thuc_hien_id_fkey')
    } finally {
      await db.query('ROLLBACK')
    }
  })
})

describe('WMS-2 · AC3 — vai trò và quyền mặc định (kiểm NỘI DUNG)', () => {
  it('đủ 10 vai trò mặc định theo §8 và §2.2, đúng mã', async () => {
    const { rows } = await db.query(
      `SELECT ma FROM vai_tro WHERE la_mac_dinh ORDER BY ma`)
    expect(rows.map((r) => r.ma)).toEqual(
      ['CSKH', 'KD', 'KT', 'KTNB', 'MH', 'NVK', 'QC', 'QLK', 'QTHT', 'TK'])
  })

  it('CẢ MƯỜI vai trò phải đúng cặp (mã, tên)', async () => {
    // Bản trước chỉ soi 2/10 — đúng hai vai trò mà R3 nêu tên ở vòng review, nên
    // đổi tên 8 cái còn lại vẫn xanh. R3 gọi đó là "vá theo phép đột biến, không
    // phải vá theo lớp lỗi", và họ đúng. Nay khẳng định trọn tập.
    const { rows } = await db.query(`SELECT ma, ten FROM vai_tro ORDER BY ma`)
    expect(rows).toEqual([
      { ma: 'CSKH', ten: 'Chăm sóc khách hàng' }, { ma: 'KD',   ten: 'Kinh doanh' },
      { ma: 'KT',   ten: 'Kế toán' },             { ma: 'KTNB', ten: 'Kiểm toán nội bộ' },
      { ma: 'MH',   ten: 'Mua hàng' },            { ma: 'NVK',  ten: 'Nhân viên kho' },
      { ma: 'QC',   ten: 'Kiểm soát chất lượng' },{ ma: 'QLK',  ten: 'Quản lý kho' },
      { ma: 'QTHT', ten: 'Quản trị hệ thống' },   { ma: 'TK',   ten: 'Thủ kho' },
    ])
  })

  it('danh mục quyền phủ ĐÚNG 20 màn hình × ĐÚNG 6 hành động của FR-20-02', async () => {
    const { rows } = await db.query(`
      SELECT count(DISTINCT man_hinh)::int AS mh, count(DISTINCT hanh_dong)::int AS hd,
             count(*)::int AS tong,
             (SELECT array_agg(DISTINCT hanh_dong ORDER BY hanh_dong) FROM quyen) AS ds,
             (SELECT array_agg(DISTINCT man_hinh ORDER BY man_hinh) FROM quyen) AS ds_mh
      FROM quyen`)
    expect(rows[0].mh).toBe(20)
    expect(rows[0].hd).toBe(6)
    // Đếm DISTINCT thôi thì đổi SC-xx thành RAC-xx vẫn xanh (R3 đã thử). Khẳng
    // định TẬP, không khẳng định lực lượng của tập.
    expect(rows[0].ds_mh).toEqual(
      Array.from({ length: 20 }, (_, i) => `SC-${String(i + 1).padStart(2, '0')}`))
    expect(rows[0].tong).toBe(120)
    expect(rows[0].ds).toEqual(['KET_XUAT', 'PHE_DUYET', 'SUA', 'TAO', 'XEM', 'XOA'])
  })

  it('QTHT có toàn quyền — chốt chặn deadlock khởi tạo', async () => {
    const { rows } = await db.query(`
      SELECT count(*)::int n FROM vai_tro_quyen vq
      JOIN vai_tro v ON v.id = vq.vai_tro_id WHERE v.ma = 'QTHT'`)
    expect(rows[0].n).toBe(120)
  })

  it('CHÍN vai trò còn lại CHƯA có quyền — AC3 chưa đạt trọn, cố ý', async () => {
    // Không phải mong muốn vận hành mà là ghi nhận một quyết định (Q3/Q4 giữ ma
    // trận §8 ngoài repo public). Test đỏ đúng lúc ai đó seed thêm, buộc họ đọc lý do.
    const { rows } = await db.query(`
      SELECT count(*)::int n FROM vai_tro_quyen vq
      JOIN vai_tro v ON v.id = vq.vai_tro_id WHERE v.ma <> 'QTHT'`)
    expect(rows[0].n).toBe(0)
  })
})

describe('WMS-2 · AC4 — BRULE-13 / DI-07: chỉ ghi thêm', () => {
  it('UPDATE một dòng nhật ký đang tồn tại bị chặn', async () => {
    expect(await voiDuLieuMoi(() => thuTrong(`UPDATE nhat_ky_thao_tac SET hanh_dong='X'`)))
      .toBe('23001')
  })
  it('DELETE một dòng nhật ký đang tồn tại bị chặn', async () => {
    expect(await voiDuLieuMoi(() => thuTrong(`DELETE FROM nhat_ky_thao_tac`))).toBe('23001')
  })
  it('TRUNCATE nhật ký bị chặn — lỗ mà reviewer R2 tìm ra', async () => {
    expect(await voiDuLieuMoi(() => thuTrong(`TRUNCATE nhat_ky_thao_tac CASCADE`)))
      .toBe('23001')
  })
  it('UPDATE, DELETE và TRUNCATE trên chuyen_dong_kho đều bị chặn', async () => {
    expect(await voiDuLieuMoi(() => thuTrong(`UPDATE chuyen_dong_kho SET so_luong=0`))).toBe('23001')
    expect(await voiDuLieuMoi(() => thuTrong(`DELETE FROM chuyen_dong_kho`))).toBe('23001')
    expect(await voiDuLieuMoi(() => thuTrong(`TRUNCATE chuyen_dong_kho CASCADE`))).toBe('23001')
  })
  // R2 và R3 độc lập cùng tìm ra: `ENABLE ALWAYS` là phòng thủ CÓ TÀI LIỆU cho một
  // đường tấn công ĐÃ BIẾT, mà không một test nào canh. Bỏ ALWAYS thì bộ test cũ
  // vẫn 27/27 trong khi nhật ký xoá sạch được. R2 còn chỉ ra chu trình
  // DISABLE TRIGGER ALL → ENABLE TRIGGER ALL hạ ALWAYS xuống ORIGIN mà không báo gì.
  it.each(['nhat_ky_thao_tac', 'chuyen_dong_kho'])(
    'session_replication_role=replica KHÔNG tắt được chốt của %s', async (bang) => {
      expect(await voiDuLieuMoi(async () => {
        await db.query(`SET LOCAL session_replication_role = 'replica'`)
        return thuTrong(`DELETE FROM ${bang}`)
      })).toBe('23001')
    })

  it('INSERT thì KHÔNG bị chặn — cặp biên của "chỉ ghi thêm"', async () => {
    // voiDuLieuMoi tự INSERT vào cả hai bảng; tới được đây nghĩa là INSERT chạy.
    expect(await voiDuLieuMoi(async () => 'ok')).toBe('ok')
  })
  it('FR-01-08: ghi được lần đăng nhập sai với tên KHÔNG tồn tại', async () => {
    // R1-F2: cột nguoi_dung_id từng NOT NULL nên trường hợp phổ biến nhất của
    // FR-01-08 không ghi được một dòng nào.
    expect(await thu(
      `INSERT INTO nhat_ky_thao_tac
         (nguoi_dung_id, ten_dang_nhap_luc_ghi, hanh_dong, loai_doi_tuong, dia_chi_ip)
       VALUES (NULL, 'khong-ton-tai', 'DANG_NHAP_THAT_BAI', 'NguoiDung', '10.0.0.9')`))
      .toBeNull()
  })
})

/** Như `thu` nhưng KHÔNG tự mở transaction — dùng bên trong voiDuLieuMoi. */
async function thuTrong(sql: string): Promise<string | null> {
  await db.query('SAVEPOINT sp')
  try {
    await db.query(sql)
    await db.query('RELEASE SAVEPOINT sp')
    return null
  } catch (e) {
    await db.query('ROLLBACK TO SAVEPOINT sp')
    return (e as { code?: string }).code ?? 'KHONG_CO_MA'
  }
}

describe('WMS-2 · DI-01 / BRULE-12 — tồn không âm trên CẢ SÁU cột', () => {
  const COT = ['so_luong_thuc_te', 'so_luong_phan_bo', 'so_luong_cho_qc',
               'so_luong_cach_ly', 'so_luong_khoa', 'so_luong_kha_dung']
  // R3-F3: bản đầu chỉ thử so_luong_thuc_te, nên thu CHECK từ 6 cột còn 1 cột
  // vẫn xanh trong khi -99 lọt vào 5 cột kia.
  it.each(COT)('số âm ở %s bị CHECK chặn', async (cot) => {
    const cols = COT.map((c) => `"${c}"`).join(', ')
    const vals = COT.map((c) => (c === cot ? '-1' : '0')).join(', ')
    expect(await thuRB(
      `INSERT INTO so_du_ton_kho (san_pham_id, kho_id, vi_tri_id, ${cols})
       VALUES (1, 1, 1, ${vals})`)).toBe('23514:so_du_ton_kho_khong_am')
  })

  it('tất cả bằng 0 thì hợp lệ — cặp biên của "không âm"', async () => {
    // Phải dựng Kho thật: khoá ngoại kho_id nay tồn tại (R1-F5), nên kho_id = 1
    // trả 23503 chứ không phải "hợp lệ". Đây là ràng buộc làm đúng việc của nó.
    const cols = COT.map((c) => `"${c}"`).join(', ')
    expect(await thu(
      `WITH k AS (INSERT INTO kho (ma, ten) VALUES ('K-DI01','Kho DI-01') RETURNING id)
       INSERT INTO so_du_ton_kho (san_pham_id, kho_id, vi_tri_id, ${cols})
       SELECT 1, k.id, 1, ${COT.map(() => '0').join(', ')} FROM k`)).toBeNull()
  })
})

describe('WMS-2 · BRULE-11 — một tổ hợp khoá chỉ có MỘT dòng số dư', () => {
  it('hai dòng trùng với lo_id NULL bị chặn — lỗ NULLS DISTINCT mà R2 tìm ra', async () => {
    const ins = `INSERT INTO so_du_ton_kho
      (san_pham_id, kho_id, vi_tri_id, lo_id, so_luong_thuc_te, so_luong_cho_qc,
       so_luong_cach_ly, so_luong_khoa, so_luong_kha_dung)
      SELECT 905, id, 905, NULL, 1, 0, 0, 0, 0 FROM kho WHERE ma = 'K-BR11'`
    expect(await thuRB(
      `INSERT INTO kho (ma, ten) VALUES ('K-BR11','Kho BR-11'); ${ins}; ${ins}`))
      .toBe('23505:so_du_ton_kho_to_hop_khoa')
  })
})

describe('WMS-2 · DI-02 — ton_sau trừ ton_truoc bằng so_luong, và tồn không âm', () => {
  const ct = (sl: number, truoc: number, sau: number) => `
    INSERT INTO chuyen_dong_kho
      (loai_giao_dich, san_pham_id, kho_id, vi_tri_id, so_luong, ton_truoc, ton_sau,
       loai_chung_tu, chung_tu_id, nguoi_thuc_hien_id, thoi_diem)
    VALUES ('NHAP', 1, 1, 1, ${sl}, ${truoc}, ${sau}, 'PhieuNhapKho', 1, 1, now())`

  it('lệch một đơn vị bị chặn', async () =>
    expect(await thuRB(ct(4, 10, 15))).toBe('23514:chuyen_dong_kho_can_doi'))
  it('quy ước dấu: xuất phải ghi số ÂM', async () =>
    expect(await thuRB(ct(3, 10, 7))).toBe('23514:chuyen_dong_kho_can_doi'))
  it('ton_sau âm bị chặn bởi ĐÚNG ràng buộc của nó', async () =>
    expect(await thuRB(ct(-15, 10, -5))).toBe('23514:chuyen_dong_kho_ton_sau_khong_am'))
})
