// do-p95-phien.mjs — WMS-1: đo chi phí lượt đọc phiên mà ADR-0002 đặt lên mọi request.
//
// LẦN VIẾT THỨ HAI. Bản đầu bị vòng review 2 người bác với 11 finding chặn
// (evd/WMS-1/dev/review.md). Bản này nhắm đúng vào chúng:
//   - Tách THỜI GIAN TRUY VẤN khỏi THỜI GIAN CHỜ POOL. Bản cũ bấm giờ bao trọn
//     `pool.query` nên 96% con số là hàng đợi do chính harness tạo ra.
//   - Lặp toàn bộ phép đo nhiều lần và phán quyết theo LẦN XẤU NHẤT. Bản cũ kết
//     luận từ một lần chạy, mà chạy lại 14 lần thì 1 lần lật phán quyết.
//   - Làm nóng pool trước khi đo (bản cũ tính cả bắt tay TCP+auth vào "tranh chấp").
//   - Mã phiên ngẫu nhiên đủ entropy theo ADR-0002 §Quyết định 1, không phải
//     'song-1'..'song-200' (bản cũ làm index bé và không phân tán).
//   - JOIN cả VaiTro: NFR-SEC-04 bắt mọi request biết vai trò, nên đường đi thật
//     là 3 bảng chứ không phải 2.
//   - Đo ĐÚNG tiêu chí NFR-PER-05 (suy giảm ≤ 20%), thay vì trích tên nó rồi bỏ qua.
//   - Bỏ `Math.max` của hai tổng thể khác nhau — không phải phân vị của cái gì cả.
//   - Bằng chứng do CHÍNH script ghi ra JSON trong một lần chạy duy nhất; báo cáo
//     trích từ file đó. Bản cũ dán số của một lần chạy khác vào báo cáo.
//   - Rào chắn CSDL đích, handler SIGINT/SIGTERM, lock_timeout khi dọn, từ chối
//     ghi đè schema có sẵn (4 finding chặn của R2).
//
//   node --env-file-if-exists=.env scripts/do-p95-phien.mjs [--ghi-de]
//
// Exit 0 = đạt cả hai ngưỡng · 1 = đo xong nhưng trượt · 2 = script lỗi · 130/143 = bị ngắt.
import { Client, Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';

const NGAN_SACH_MS = 500;                 // NFR-PER-02
const TY_LE_TOI_DA = 0.10;                // ADR-0002 tự đặt
const NGUONG_MS = NGAN_SACH_MS * TY_LE_TOI_DA;
// NFR-PER-05 nói "không suy giảm quá 20% THỜI GIAN PHẢN HỒI" ở 200 người đồng
// thời — đó là tiêu chí ở mức MÀN HÌNH, mà màn hình thì chưa tồn tại. Script này
// đo một THÀNH PHẦN. Vì vậy nó báo mức suy giảm của thành phần như một chỉ số
// cảnh báo, và KHÔNG tuyên bố đạt/trượt NFR-PER-05 — đó là việc của phép đo đầu
// cuối sau này. Bản viết đầu trích tên NFR-PER-05 rồi bỏ qua tiêu chí; sửa nó
// thành một phán quyết đạt/trượt cũng sai y như vậy, chỉ theo hướng ngược lại.
const SUY_GIAM_CANH_BAO = 0.20;           // mốc để BẬT CẢNH BÁO, không phải để phán quyết

const NGUOI_DONG_THOI = 200;              // NFR-PER-05
const LUOT_MOI_NGUOI = 5;
const POOL = 20;                          // GIẢ ĐỊNH, chưa chốt — xem ADR-0002 C-3
const NEN_SO_LUOT = 300;
const LAM_NONG = 200;
const SO_LAN_LAP = 5;                     // phán quyết lấy lần XẤU NHẤT
const SCHEMA = 'wms1_do_thu';

// Hai hồ sơ dữ liệu để trả lời câu "rác có tác dụng không" bằng số, thay vì
// bày 50.000 dòng rác ra rồi ngầm coi đó là sức ép (finding Ghi nhận 8).
const HO_SO = [
  { ten: 'sach', phienSong: 200, phienRac: 0 },
  { ten: 'rac_2_trieu', phienSong: 200, phienRac: 2_000_000 },
];

function phanVi(mang, p) {
  if (mang.length === 0) throw new Error('phanVi: mảng rỗng');
  const sx = [...mang].sort((a, b) => a - b);
  const i = (sx.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sx[lo] : sx[lo] + (sx[hi] - sx[lo]) * (i - lo);
}
const tomTat = (a) => ({
  n: a.length, p50: phanVi(a, 0.5), p95: phanVi(a, 0.95), p99: phanVi(a, 0.99),
  max: Math.max(...a),
});
const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;

// ─── Rào chắn: script này DROP/CREATE SCHEMA, nó phải biết mình đang ở đâu ───
// R2 chứng minh `--env-file-if-exists` KHÔNG ghi đè DATABASE_URL đã export sẵn
// trong shell, nên "tôi có .env trỏ localhost" không phải bảo đảm gì cả.
function kiemTraDich(url) {
  const u = new URL(url);
  const host = u.hostname, db = u.pathname.replace(/^\//, '');
  const chotay = process.env.WMS1_CHO_PHEP_HOST;
  const noiBo = ['localhost', '127.0.0.1', '::1', ''].includes(host);
  console.log(`CSDL đích        : ${host || '(socket)'} / ${db}`);
  if (!noiBo && chotay !== host) {
    throw new Error(
      `từ chối chạy: ${host} không phải máy cục bộ. Script này DROP/CREATE SCHEMA `
      + `và bơm ${HO_SO.at(-1).phienRac.toLocaleString('vi')} dòng. Cố ý nhắm vào host này thì `
      + `đặt WMS1_CHO_PHEP_HOST=${host}.`);
  }
  return { host: host || '(socket)', db };
}

async function donDep(c, { onao = true } = {}) {
  try {
    // lock_timeout: R2 dựng một session giữ ACCESS EXCLUSIVE và bản cũ treo bằng
    // đúng thời gian khoá — treo lâu thì người ta Ctrl-C, và rác ở lại vĩnh viễn.
    await c.query("SET lock_timeout = '5s'");
    await c.query("SET statement_timeout = '30s'");
    await c.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    if (onao) console.log(`đã dọn schema ${SCHEMA}`);
  } catch (e) {
    console.error(`⚠️  KHÔNG dọn được schema ${SCHEMA}: ${e.message}`);
    console.error(`    dọn tay: DROP SCHEMA ${SCHEMA} CASCADE;`);
  }
}

async function dungDuLieu(c, hs) {
  await c.query(`CREATE SCHEMA ${SCHEMA}`);
  daTaoSchema = true;
  await c.query(`CREATE TABLE ${SCHEMA}.vai_tro (
      id smallint PRIMARY KEY, ma text NOT NULL)`);
  await c.query(`CREATE TABLE ${SCHEMA}.nguoi_dung (
      id integer PRIMARY KEY, vai_tro_id smallint NOT NULL REFERENCES ${SCHEMA}.vai_tro(id),
      dang_hoat_dong boolean NOT NULL)`);
  // Cột đúng theo ADR-0002 §Quyết định 1 — bản cũ bỏ bớt nên dòng hẹp hơn thực tế.
  await c.query(`CREATE TABLE ${SCHEMA}.phien (
      id text PRIMARY KEY, nguoi_dung_id integer NOT NULL REFERENCES ${SCHEMA}.nguoi_dung(id),
      kho_hien_tai_id integer, tao_luc timestamptz NOT NULL,
      thao_tac_cuoi_luc timestamptz NOT NULL, het_han_luc timestamptz NOT NULL,
      dia_chi_ip inet NOT NULL)`);

  await c.query(`INSERT INTO ${SCHEMA}.vai_tro
      SELECT g, 'VT-' || g FROM generate_series(1, 9) g`);
  await c.query(`INSERT INTO ${SCHEMA}.nguoi_dung
      SELECT g, (g % 9) + 1, (g % 20) <> 0 FROM generate_series(1, 500) g`);
  // Mã phiên 64 ký tự hex, phân tán như ADR-0002 đòi (bản cũ dùng 'song-1'..'song-200').
  const MA = `md5('wms1-song-' || g) || md5('b' || g)`;
  const MA_RAC = `md5('wms1-het-' || g) || md5('c' || g)`;
  await c.query(`INSERT INTO ${SCHEMA}.phien
      SELECT ${MA}, (g % 500) + 1, (g % 5) + 1, now(), now(),
             now() + interval '30 minutes', '10.0.0.1'::inet
      FROM generate_series(1, $1) g`, [hs.phienSong]);
  if (hs.phienRac > 0) {
    await c.query(`INSERT INTO ${SCHEMA}.phien
        SELECT ${MA_RAC}, (g % 500) + 1, (g % 5) + 1, now() - interval '3 days',
               now() - interval '3 days', now() - interval '2 days', '10.0.0.2'::inet
        FROM generate_series(1, $1) g`, [hs.phienRac]);
  }
  await c.query(`ANALYZE ${SCHEMA}.phien`);
  await c.query(`ANALYZE ${SCHEMA}.nguoi_dung`);
  await c.query(`ANALYZE ${SCHEMA}.vai_tro`);
  // Chỉ lấy phiên của người dùng CÒN hoạt động: truy vấn có điều kiện
  // `u.dang_hoat_dong`, nên phiên của tài khoản đã khoá trả 0 dòng và sẽ đo
  // nhánh thoát sớm chứ không phải đường đi đầy đủ 3 bảng. Bản chạy đầu vấp
  // đúng chỗ này (284/300) và guard đã chặn lại — giữ guard, sửa dữ liệu vào.
  const { rows } = await c.query(`
    SELECT p.id FROM ${SCHEMA}.phien p
      JOIN ${SCHEMA}.nguoi_dung u ON u.id = p.nguoi_dung_id
     WHERE p.het_han_luc > now() AND u.dang_hoat_dong
     ORDER BY p.id`);
  const { rows: [kt] } = await c.query(`
      SELECT pg_total_relation_size('${SCHEMA}.phien') AS bytes,
             (SELECT count(*) FROM ${SCHEMA}.phien)::bigint AS so_dong`);
  return { maPhien: rows.map((r) => r.id), bytes: Number(kt.bytes), soDong: Number(kt.so_dong) };
}

// Đúng đường đi ADR-0002 §Quyết định 2 mô tả, cộng VaiTro mà NFR-SEC-04 bắt buộc.
const SQL = (s) => `
  SELECT p.id, p.nguoi_dung_id, p.kho_hien_tai_id, p.thao_tac_cuoi_luc,
         p.het_han_luc, p.dia_chi_ip, u.dang_hoat_dong, v.ma AS vai_tro
    FROM ${s}.phien p
    JOIN ${s}.nguoi_dung u ON u.id = p.nguoi_dung_id
    JOIN ${s}.vai_tro    v ON v.id = u.vai_tro_id
   WHERE p.id = $1 AND p.het_han_luc > now() AND u.dang_hoat_dong`;

async function doMotLan(url, maPhien, lan) {
  const sql = SQL(SCHEMA);
  const boc = (i) => maPhien[(i * 7919 + lan * 104729) % maPhien.length]; // phủ đều, tất định
  let dem = 0;

  // PHA A — nền: một kết nối, tuần tự. Đây là mẫu số của NFR-PER-05.
  const nen = new Client({ connectionString: url });
  await nen.connect();
  const tNen = [];
  try {
    for (let i = 0; i < LAM_NONG; i++) await nen.query(sql, [boc(i)]);
    for (let i = 0; i < NEN_SO_LUOT; i++) {
      const t0 = process.hrtime.bigint();
      const r = await nen.query(sql, [boc(i)]);
      tNen.push(ms(t0));
      if (r.rowCount === 1) dem++;
    }
  } finally { await nen.end(); }
  if (dem !== NEN_SO_LUOT) throw new Error(`pha nền: ${dem}/${NEN_SO_LUOT} lượt trúng phiên`);

  // PHA B — 200 người đồng thời. Pool ĐƯỢC LÀM NÓNG trước, và thời gian chờ pool
  // được đo TÁCH khỏi thời gian truy vấn: chờ pool là hệ quả của kích thước pool
  // (tham số ứng dụng), không phải chi phí CSDL mà ADR-0002 hỏi.
  const pool = new Pool({ connectionString: url, max: POOL });
  const tCho = [], tTruyVan = [];
  try {
    const nong = await Promise.all(Array.from({ length: POOL }, () => pool.connect()));
    await Promise.all(nong.map((cl) => cl.query('SELECT 1')));
    nong.forEach((cl) => cl.release());

    const mot = async (u) => {
      for (let i = 0; i < LUOT_MOI_NGUOI; i++) {
        const t0 = process.hrtime.bigint();
        const cl = await pool.connect();
        tCho.push(ms(t0));
        try {
          const t1 = process.hrtime.bigint();
          const r = await cl.query(sql, [boc(u * 31 + i)]);
          tTruyVan.push(ms(t1));
          if (r.rowCount !== 1) throw new Error('pha tải: lượt đọc không trúng phiên');
        } finally { cl.release(); }
      }
    };
    const kq = await Promise.allSettled(
      Array.from({ length: NGUOI_DONG_THOI }, (_, u) => mot(u)));
    const loi = kq.find((x) => x.status === 'rejected');
    if (loi) throw loi.reason;
  } finally { await pool.end(); }

  return { nen: tomTat(tNen), choPool: tomTat(tCho), truyVanTai: tomTat(tTruyVan) };
}

let khachDon = null;   // dùng cho handler tín hiệu
// Chỉ dọn khi CHÍNH script này đã tạo schema. Nếu rào chắn từ chối vì schema có
// sẵn của người khác thì tuyệt đối không được đụng vào nó — từ chối rồi lại xoá
// còn tệ hơn là xoá thẳng.
let daTaoSchema = false;
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL chưa cấu hình — xem .env.example');
  const dich = kiemTraDich(url);

  const c = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await c.connect();
  khachDon = c;
  try {
    const { rows: [co] } = await c.query(
      `SELECT count(*)::int n FROM information_schema.schemata WHERE schema_name = $1`, [SCHEMA]);
    if (co.n > 0 && !process.argv.includes('--ghi-de')) {
      throw new Error(`schema ${SCHEMA} ĐÃ TỒN TẠI trên ${dich.host}/${dich.db}. `
        + `Script sẽ xoá nó cùng mọi thứ bên trong. Cố ý thì chạy lại với --ghi-de.`);
    }
    if (co.n > 0) console.log(`⚠️  --ghi-de: schema ${SCHEMA} có sẵn sẽ bị XOÁ`);

    const { rows: [moiTruong] } = await c.query(
      `SELECT version() AS pg, current_setting('shared_buffers') AS sb`);

    const ketQua = [];
    for (const hs of HO_SO) {
      await donDep(c, { onao: false });
      process.stdout.write(`\nhồ sơ ${hs.ten}: dựng dữ liệu…`);
      const { maPhien, bytes, soDong } = await dungDuLieu(c, hs);
      console.log(` ${soDong.toLocaleString('vi')} dòng, ${(bytes / 1048576).toFixed(1)} MB`);
      const lan = [];
      for (let i = 0; i < SO_LAN_LAP; i++) {
        const r = await doMotLan(url, maPhien, i);
        lan.push(r);
        console.log(`  lần ${i + 1}: nền p95 ${r.nen.p95.toFixed(3)} ms · `
          + `truy vấn khi tải p95 ${r.truyVanTai.p95.toFixed(3)} ms · `
          + `chờ pool p95 ${r.choPool.p95.toFixed(3)} ms`);
      }
      // Phán quyết theo lần XẤU NHẤT, không phải một lần chạy may mắn.
      const xauNhat = Math.max(...lan.map((x) => x.truyVanTai.p95));
      const nenXau = Math.max(...lan.map((x) => x.nen.p95));
      const suyGiam = (xauNhat - nenXau) / nenXau;
      ketQua.push({ hoSo: hs.ten, soDong, bytes, lan, truyVanTaiP95XauNhat: xauNhat,
                    nenP95XauNhat: nenXau, suyGiamTyLe: suyGiam });
      console.log(`  → xấu nhất trong ${SO_LAN_LAP} lần: truy vấn p95 = ${xauNhat.toFixed(3)} ms `
        + `(nền ${nenXau.toFixed(3)} ms, suy giảm ${(suyGiam * 100).toFixed(1)}%)`);
    }
    const canCu = Math.max(...ketQua.map((k) => k.truyVanTaiP95XauNhat));
    const suyGiamXau = Math.max(...ketQua.map((k) => k.suyGiamTyLe));
    const choPoolXau = Math.max(...ketQua.flatMap((k) => k.lan.map((l) => l.choPool.p95)));
    const datNganSach = canCu <= NGUONG_MS;
    const canhBaoSuyGiam = suyGiamXau > SUY_GIAM_CANH_BAO;

    const bangChung = {
      ticket: 'WMS-1', ngay: new Date().toISOString(), lanViet: 2,
      moiTruong: { pg: moiTruong.pg.split(',')[0], sharedBuffers: moiTruong.sb,
                   host: dich.host, db: dich.db, pool: POOL,
                   nguoiDongThoi: NGUOI_DONG_THOI, soLanLap: SO_LAN_LAP },
      nguong: { nganSachMs: NGAN_SACH_MS, tyLeToiDa: TY_LE_TOI_DA, nguongMs: NGUONG_MS,
                mocCanhBaoSuyGiam: SUY_GIAM_CANH_BAO },
      ketQua,
      phanQuyet: {
        // Phán quyết DUY NHẤT mà phép đo này có tư cách đưa ra.
        truyVanP95CanCu: canCu, datNganSachAdr0002: datNganSach,
        ket: datNganSach ? 'DAT' : 'TRUOT',
      },
      quanSat: {
        // Số liệu, không phải phán quyết.
        suyGiamThanhPhanXauNhat: suyGiamXau, canhBaoSuyGiam,
        choPoolP95XauNhat: choPoolXau,
        ghiChuNfrPer05: 'NFR-PER-05 là tiêu chí ở mức màn hình (thời gian phản hồi '
          + 'đầu cuối). Phép đo này đo một thành phần nên KHÔNG kết luận đạt/trượt '
          + 'NFR-PER-05. Con số suy giảm ở đây là cảnh báo mang sang WMS-2.',
      },
    };
    mkdirSync('evd/WMS-1', { recursive: true });
    writeFileSync('evd/WMS-1/do-p95.json', JSON.stringify(bangChung, null, 2) + '\n');

    console.log(`\n=== PHÁN QUYẾT (lần xấu nhất trên mọi hồ sơ và mọi lần lặp) ===`);
    console.log(`truy vấn p95 căn cứ : ${canCu.toFixed(3)} ms / ngưỡng ${NGUONG_MS} ms`
      + `  -> ADR-0002 ${datNganSach ? 'ĐẠT' : 'TRƯỢT'}`);
    console.log(`\n--- quan sát, KHÔNG phải phán quyết ---`);
    console.log(`suy giảm của thành phần CSDL khi 200 người: ${(suyGiamXau * 100).toFixed(1)}%`
      + `${canhBaoSuyGiam ? '  ⚠️  vượt mốc cảnh báo ' + SUY_GIAM_CANH_BAO * 100 + '%' : ''}`);
    console.log(`chờ pool p95 xấu nhất : ${choPoolXau.toFixed(3)} ms — LỚN HƠN chi phí truy vấn`);
    console.log(`  vài lần. Đây là hệ quả của kích thước pool (${POOL}, giả định chưa chốt),`);
    console.log(`  không phải chi phí CSDL, nên không nằm trong phán quyết trên — nhưng nó`);
    console.log(`  là thành phần lớn nhất mà người dùng thật sẽ cảm thấy. WMS-2 phải chốt nó.`);
    console.log(`NFR-PER-05 là tiêu chí ở mức MÀN HÌNH; chưa có màn hình nào nên phép đo này`);
    console.log(`  không đủ tư cách kết luận đạt/trượt nó.`);
    console.log(`bằng chứng: evd/WMS-1/do-p95.json (ghi từ chính lần chạy này)`);
    return datNganSach ? 0 : 1;
  } finally {
    // Lỗi giữa chừng cũng phải dọn — lần chạy hỏng đầu tiên của bản này để lại
    // schema y hệt cái mà R2 đã cảnh báo, chỉ khác đường đi (throw thay vì SIGINT).
    if (daTaoSchema) await donDep(c, { onao: false });
    khachDon = null;
    await c.end().catch(() => {});
  }
}

// R2 chứng minh Ctrl-C bỏ lại schema vĩnh viễn. Đây là cách dừng phổ biến nhất.
for (const [tin, ma] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(tin, async () => {
    console.error(`\n${tin} — đang dọn trước khi thoát…`);
    if (khachDon && daTaoSchema) await donDep(khachDon).catch(() => {});
    await khachDon?.end().catch(() => {});
    process.exit(ma);
  });
}

main().then((m) => process.exit(m)).catch((e) => {
  console.error('do-p95-phien: ' + e.message);
  process.exit(2);
});
