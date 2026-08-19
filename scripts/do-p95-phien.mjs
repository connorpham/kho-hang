// do-p95-phien.mjs — WMS-1: đo p95 của lượt đọc phiên mà ADR-0002 đặt lên mọi request.
//
// VÌ SAO CÓ FILE NÀY
// ADR-0002 chọn kiểm phiên bằng một lượt đọc CSDL trên MỌI request, dựa trên lập
// luận "khoá chính có chỉ mục thì rất nhanh". Lập luận không phải phép đo. ADR tự
// đặt điều kiện: nếu lượt đọc này ăn quá 10% ngân sách 500 ms của NFR-PER-02 thì
// ADR phải mở lại. Script này đi lấy con số đó.
//
//   node --env-file-if-exists=.env scripts/do-p95-phien.mjs
//
// Exit 0 = dưới ngưỡng (ADR-0002 đủ điều kiện chốt) · 1 = trên ngưỡng (mở lại ADR).
//
// PHẠM VI: chỉ đo. Không tạo bảng thật, không migration — mọi thứ nằm trong schema
// `do_thu` và bị xoá ở cuối, kể cả khi script lỗi giữa chừng.
import { Client, Pool } from 'pg';

const NGAN_SACH_MS = 500;      // NFR-PER-02: p95 xác nhận thao tác quét
const TY_LE_TOI_DA = 0.10;     // ADR-0002 tự đặt: lượt đọc phiên không được ăn quá 10%
const NGUONG_MS = NGAN_SACH_MS * TY_LE_TOI_DA;

const PHIEN_SONG = 200;        // = NFR-PER-05, 200 người dùng đồng thời
const PHIEN_HET_HAN = 50_000;  // rác tích tụ mà bảng phiên phải sống chung
const SO_LUOT_DO = 1_000;
const SO_LUOT_LAM_NONG = 200;
const NGUOI_DONG_THOI = 200;   // NFR-PER-05
const LUOT_MOI_NGUOI = 10;
const KICH_THUOC_POOL = 20;    // pool cố định của tiến trình container (SRS §2.3)

// Bộ sinh số giả ngẫu nhiên có hạt cố định: hai lần chạy chọn cùng dãy phiên,
// nếu không thì hai lần đo khác nhau vì lý do không liên quan đến hiệu năng.
function taoRng(hat) {
  let s = hat >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x1_0000_0000);
}

function phanVi(mang, p) {
  const sx = [...mang].sort((a, b) => a - b);
  // Nội suy tuyến tính giữa hai mốc — với n=1000 thì lấy phần tử thứ ceil(p·n)
  // cũng ra gần như vậy, nhưng nội suy không phụ thuộc vào n chẵn hay lẻ.
  const i = (sx.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sx[lo] : sx[lo] + (sx[hi] - sx[lo]) * (i - lo);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL chưa cấu hình — xem .env.example');
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await c.connect();
  try {
    await c.query('DROP SCHEMA IF EXISTS do_thu CASCADE');
    await c.query('CREATE SCHEMA do_thu');
    await c.query(`
      CREATE TABLE do_thu.nguoi_dung (
        id            integer PRIMARY KEY,
        dang_hoat_dong boolean NOT NULL
      )`);
    await c.query(`
      CREATE TABLE do_thu.phien (
        id               text PRIMARY KEY,
        nguoi_dung_id    integer NOT NULL REFERENCES do_thu.nguoi_dung(id),
        kho_hien_tai_id  integer,
        thao_tac_cuoi_luc timestamptz NOT NULL,
        het_han_luc      timestamptz NOT NULL
      )`);

    const soNguoiDung = 500;
    await c.query(
      `INSERT INTO do_thu.nguoi_dung (id, dang_hoat_dong)
       SELECT g, (g % 20) <> 0 FROM generate_series(1, $1) g`, [soNguoiDung]);
    // Phiên còn sống: id có tiền tố song- để lấy lại được khi đo.
    await c.query(
      `INSERT INTO do_thu.phien
       SELECT 'song-' || g, (g % $2) + 1, (g % 5) + 1, now(), now() + interval '30 minutes'
       FROM generate_series(1, $1) g`, [PHIEN_SONG, soNguoiDung]);
    // Rác: phiên đã hết hạn, chưa ai dọn — đúng cảnh mà ADR-0002 cảnh báo.
    await c.query(
      `INSERT INTO do_thu.phien
       SELECT 'het-' || g, (g % $2) + 1, (g % 5) + 1,
              now() - interval '2 days', now() - interval '2 days'
       FROM generate_series(1, $1) g`, [PHIEN_HET_HAN, soNguoiDung]);
    await c.query('ANALYZE do_thu.phien');
    await c.query('ANALYZE do_thu.nguoi_dung');

    const { rows: [{ n }] } = await c.query('SELECT count(*)::int AS n FROM do_thu.phien');

    // Đúng truy vấn mà ADR-0002 điều khoản 2 mô tả: đọc phiên theo khoá chính,
    // join sang cờ hoạt động của tài khoản để thu hồi có hiệu lực ngay.
    const SQL = `
      SELECT p.id, p.nguoi_dung_id, p.kho_hien_tai_id, p.thao_tac_cuoi_luc,
             p.het_han_luc, u.dang_hoat_dong
        FROM do_thu.phien p
        JOIN do_thu.nguoi_dung u ON u.id = p.nguoi_dung_id
       WHERE p.id = $1 AND p.het_han_luc > now()`;

    const rng = taoRng(20260819);
    const id = () => 'song-' + (1 + Math.floor(rng() * PHIEN_SONG));

    for (let i = 0; i < SO_LUOT_LAM_NONG; i++) await c.query(SQL, [id()]);

    const doMs = [];
    let soLanTrungPhien = 0;
    for (let i = 0; i < SO_LUOT_DO; i++) {
      const k = id();
      const t0 = process.hrtime.bigint();
      const r = await c.query(SQL, [k]);
      doMs.push(Number(process.hrtime.bigint() - t0) / 1e6);
      if (r.rowCount === 1) soLanTrungPhien++;
    }
    // Nếu truy vấn không trả về gì thì con số đo được là thời gian của một lượt
    // trượt, không phải của lượt đọc thật — phải đỏ chứ không được báo "nhanh".
    if (soLanTrungPhien !== SO_LUOT_DO) {
      throw new Error(`chỉ ${soLanTrungPhien}/${SO_LUOT_DO} lượt tìm thấy phiên — `
        + 'phép đo không đại diện cho đường đi thật, kết quả bị loại');
    }

    // PHA 2 — đo dưới tranh chấp. Pha 1 chạy một mình nên nó chỉ trả lời "truy vấn
    // này có nhanh không", KHÔNG trả lời "nó còn nhanh khi 200 người cùng vào
    // không" — mà đó mới là câu NFR-PER-05 hỏi và là rủi ro thật của ADR-0002.
    const pool = new Pool({ connectionString: url, max: KICH_THUOC_POOL });
    let doTaiMs = [];
    try {
      const chay = async () => {
        const t = [];
        for (let i = 0; i < LUOT_MOI_NGUOI; i++) {
          const t0 = process.hrtime.bigint();
          const r = await pool.query(SQL, [id()]);
          t.push(Number(process.hrtime.bigint() - t0) / 1e6);
          if (r.rowCount !== 1) throw new Error('lượt đọc dưới tải không tìm thấy phiên');
        }
        return t;
      };
      const tatCa = await Promise.all(Array.from({ length: NGUOI_DONG_THOI }, chay));
      doTaiMs = tatCa.flat();
    } finally {
      await pool.end();
    }

    const kq = {
      soDongTrongBangPhien: n,
      phienConSong: PHIEN_SONG,
      soLuotDo: SO_LUOT_DO,
      p50: phanVi(doMs, 0.50), p95: phanVi(doMs, 0.95), p99: phanVi(doMs, 0.99),
      min: Math.min(...doMs), max: Math.max(...doMs),
      taiP50: phanVi(doTaiMs, 0.50), taiP95: phanVi(doTaiMs, 0.95),
      taiP99: phanVi(doTaiMs, 0.99), taiSoLuot: doTaiMs.length,
      nguongMs: NGUONG_MS,
    };
    const f = (x) => x.toFixed(3).padStart(8);
    console.log(`bảng phiên      : ${kq.soDongTrongBangPhien} dòng (${PHIEN_SONG} sống + ${PHIEN_HET_HAN} hết hạn)`);
    console.log(`số lượt đo      : ${kq.soLuotDo} (sau ${SO_LUOT_LAM_NONG} lượt làm nóng)`);
    console.log(`p50             : ${f(kq.p50)} ms`);
    console.log(`p95             : ${f(kq.p95)} ms   <-- con số ADR-0002 cần`);
    console.log(`p99             : ${f(kq.p99)} ms`);
    console.log(`min / max       : ${f(kq.min)} / ${f(kq.max)} ms`);
    console.log(`--- dưới tải: ${NGUOI_DONG_THOI} người đồng thời, pool ${KICH_THUOC_POOL} kết nối ---`);
    console.log(`số lượt đo      : ${kq.taiSoLuot}`);
    console.log(`p50 / p95 / p99 : ${f(kq.taiP50)} / ${f(kq.taiP95)} / ${f(kq.taiP99)} ms`);
    console.log(`ngưỡng ADR-0002 : ${f(NGUONG_MS)} ms (10% của ngân sách ${NGAN_SACH_MS} ms, NFR-PER-02)`);
    // Lấy con số XẤU HƠN làm căn cứ kết luận: p95 lúc rảnh rỗi là con số dễ chịu,
    // không phải con số hệ thống thật sẽ gặp.
    const p95CanCu = Math.max(kq.p95, kq.taiP95);
    const dat = p95CanCu <= NGUONG_MS;
    console.log(dat
      ? `KẾT LUẬN: p95 căn cứ (xấu hơn trong hai pha) = ${p95CanCu.toFixed(3)} ms, chiếm ${(p95CanCu / NGAN_SACH_MS * 100).toFixed(2)}% ngân sách -> ADR-0002 ĐỦ ĐIỀU KIỆN CHỐT`
      : `KẾT LUẬN: p95 căn cứ = ${p95CanCu.toFixed(3)} ms vượt ngưỡng ${NGUONG_MS} ms -> ADR-0002 PHẢI MỞ LẠI`);
    return dat ? 0 : 1;
  } finally {
    await c.query('DROP SCHEMA IF EXISTS do_thu CASCADE');
    await c.end();
  }
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error('do-p95-phien: ' + e.message);
  process.exit(2);
});
