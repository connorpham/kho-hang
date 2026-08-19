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
// ADR-0002 Sửa đổi 1: pool KHÔNG còn là tham số vận hành. Nó là biến khảo sát,
// và phán quyết đọc ở cấu hình mà ADR đặt tạm.
const POOL_QUET = [10, 20, 40];
const POOL_PHAN_QUYET = 20;               // ADR-0002 Sửa đổi 1, quyết định tạm
const NEN_SO_LUOT = 300;
const LAM_NONG = 200;
// 3 lần là quá ít: cùng pool 20 đã thấy 11,1–35,9 ms, tức độ dao động LỚN HƠN
// biên tới trần. Phán quyết vẫn lấy lần xấu nhất, nhưng báo cáo phải cho thấy cả
// trung vị và toàn bộ dãy để người đọc tự thấy con số ổn định tới đâu.
const SO_LAN_LAP = 7;
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
    // SET LOCAL, không SET: bản trước đặt lên SESSION nên câu INSERT 2 triệu dòng
    // sau đó thừa hưởng statement_timeout=30s — mà nó mất 26,2 s, dư 15%. R1 gặp
    // 3 lần script chết ở đúng đó. SET LOCAL chỉ sống trong transaction này.
    await c.query('BEGIN');
    await c.query("SET LOCAL lock_timeout = '5s'");
    await c.query("SET LOCAL statement_timeout = '30s'");
    await c.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await c.query('COMMIT');
    if (onao) console.log(`đã dọn schema ${SCHEMA}`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
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
  SELECT p.id, p.nguoi_dung_id, p.kho_hien_tai_id, p.tao_luc, p.thao_tac_cuoi_luc,
         p.het_han_luc, p.dia_chi_ip, u.dang_hoat_dong, v.ma AS vai_tro
    FROM ${s}.phien p
    JOIN ${s}.nguoi_dung u ON u.id = p.nguoi_dung_id
    JOIN ${s}.vai_tro    v ON v.id = u.vai_tro_id
   WHERE p.id = $1 AND p.het_han_luc > now() AND u.dang_hoat_dong`;

async function doMotLan(url, maPhien, lan, pool_n) {
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
  const pool = new Pool({ connectionString: url, max: pool_n });
  const tCho = [], tTruyVan = [], tTong = [];
  try {
    const nong = await Promise.all(Array.from({ length: pool_n }, () => pool.connect()));
    await Promise.all(nong.map((cl) => cl.query('SELECT 1')));
    nong.forEach((cl) => cl.release());

    const mot = async (u) => {
      for (let i = 0; i < LUOT_MOI_NGUOI; i++) {
        // Ba con số ĐỒNG BỘ theo từng lượt. Bản trước chỉ giữ hai mảng RỜI nên
        // p95 của tổng không khôi phục được từ bằng chứng — đúng finding MỚI-1.
        const t0 = process.hrtime.bigint();
        const cl = await pool.connect();
        const cho = ms(t0);
        try {
          const t1 = process.hrtime.bigint();
          const r = await cl.query(sql, [boc(u * 31 + i)]);
          tCho.push(cho); tTruyVan.push(ms(t1)); tTong.push(ms(t0));
          if (r.rowCount !== 1) throw new Error('pha tải: lượt đọc không trúng phiên');
        } finally { cl.release(); }
      }
    };
    const kq = await Promise.allSettled(
      Array.from({ length: NGUOI_DONG_THOI }, (_, u) => mot(u)));
    const loi = kq.find((x) => x.status === 'rejected');
    if (loi) throw loi.reason;
  } finally { await pool.end(); }

  // suyGiam tính TRONG CÙNG một lần lặp — bản trước ghép max của lần này với max
  // của lần khác, tức tỉ số của hai tổng thể không cùng nguồn (finding CHẶN 5).
  const tomNen = tomTat(tNen), tomTong = tomTat(tTong);
  return { nen: tomNen, choPool: tomTat(tCho), truyVanTai: tomTat(tTruyVan),
           tong: tomTong, suyGiamTrongLan: (tomTong.p95 - tomNen.p95) / tomNen.p95 };
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

    // Rào chắn MỚI-3: pool >= max_connections làm Promise.all(connect) bị từ chối
    // một phần, client đã lấy không bao giờ release, pool.end() không bao giờ
    // resolve -> treo vô hạn VÀ chiếm sạch kết nối, cả máy không ai vào CSDL được.
    const { rows: [mc] } = await c.query('SHOW max_connections');
    const tran = Number(mc.max_connections) - 10;   // chừa 10 cho quản trị
    const quaTay = POOL_QUET.filter((n) => n >= tran);
    if (quaTay.length) {
      throw new Error(`từ chối chạy: pool ${quaTay.join(', ')} >= max_connections `
        + `${mc.max_connections} trừ dự phòng. Cấu hình này không làm chậm, nó làm `
        + `treo tiến trình và chiếm sạch kết nối của CSDL.`);
    }

    const ketQua = [];
    for (const hs of HO_SO) {
      await donDep(c, { onao: false });
      process.stdout.write(`\nhồ sơ ${hs.ten}: dựng dữ liệu…`);
      const { maPhien, bytes, soDong } = await dungDuLieu(c, hs);
      console.log(` ${soDong.toLocaleString('vi')} dòng, ${(bytes / 1048576).toFixed(1)} MB`);
      for (const pn of POOL_QUET) {
        const lan = [];
        for (let i = 0; i < SO_LAN_LAP; i++) lan.push(await doMotLan(url, maPhien, i, pn));
        const tongP95 = lan.map((x) => x.tong.p95);
        const suyGiam = lan.map((x) => x.suyGiamTrongLan);
        const xau = Math.max(...tongP95);
        const tv = [...tongP95].sort((a, b) => a - b)[Math.floor(tongP95.length / 2)];
        console.log(`  pool ${String(pn).padStart(2)}: TỔNG p95 mỗi lần `
          + `${tongP95.map((x) => x.toFixed(1)).join(' ')} → trung vị ${tv.toFixed(1)}, `
          + `xấu nhất ${xau.toFixed(1)} ms`
          + `  (truy vấn ${Math.max(...lan.map((x) => x.truyVanTai.p95)).toFixed(2)}, `
          + `chờ ${Math.max(...lan.map((x) => x.choPool.p95)).toFixed(2)})`);
        const sx = [...tongP95].sort((a, b) => a - b);
        ketQua.push({ hoSo: hs.ten, soDong, bytes, pool: pn, lan,
                      tongP95XauNhat: xau,
                      tongP95TrungVi: sx[Math.floor(sx.length / 2)],
                      tongP95MoiLan: tongP95,
                      suyGiamKhoang: [Math.min(...suyGiam), Math.max(...suyGiam)] });
      }
    }

    // Phán quyết đọc ở ĐÚNG cấu hình mà ADR-0002 Sửa đổi 1 đặt tạm, và đọc trên
    // TỔNG (chờ + truy vấn) vì A4 đã chốt trần 50 ms gồm cả chi phí lấy kết nối.
    const oPhanQuyet = ketQua.filter((k) => k.pool === POOL_PHAN_QUYET);
    if (!oPhanQuyet.length) throw new Error('không có cấu hình phán quyết trong bộ quét');
    const canCu = Math.max(...oPhanQuyet.map((k) => k.tongP95XauNhat));
    const datNganSach = canCu <= NGUONG_MS;
    const suyGiamKhoang = [
      Math.min(...oPhanQuyet.flatMap((k) => k.suyGiamKhoang)),
      Math.max(...oPhanQuyet.flatMap((k) => k.suyGiamKhoang))];
    const canhBaoSuyGiam = suyGiamKhoang[1] > SUY_GIAM_CANH_BAO;
    const choPoolXau = Math.max(...oPhanQuyet.flatMap((k) => k.lan.map((l) => l.choPool.p95)));
    const truyVanXau = Math.max(...oPhanQuyet.flatMap((k) => k.lan.map((l) => l.truyVanTai.p95)));
    // Bằng chứng cho quy tắc pool của ADR: TỔNG thay đổi thế nào theo pool.
    const theoPool = POOL_QUET.map((pn) => ({
      pool: pn,
      tongP95XauNhat: Math.max(...ketQua.filter((k) => k.pool === pn).map((k) => k.tongP95XauNhat)),
      tongP95TrungViXau: Math.max(...ketQua.filter((k) => k.pool === pn).map((k) => k.tongP95TrungVi)),
    }));

    const bangChung = {
      ticket: 'WMS-1', ngay: new Date().toISOString(), lanViet: 3,
      docTheo: 'TỔNG chờ pool + truy vấn — A4 (2026-08-19) chốt trần 50 ms GỒM chi '
        + 'phí lấy kết nối; ADR-0002 Sửa đổi 1',
      moiTruong: { pg: moiTruong.pg.split(',')[0], sharedBuffers: moiTruong.sb,
                   maxConnections: mc.max_connections, host: dich.host, db: dich.db,
                   nguoiDongThoi: NGUOI_DONG_THOI, soLanLap: SO_LAN_LAP,
                   poolQuet: POOL_QUET, poolPhanQuyet: POOL_PHAN_QUYET },
      nguong: { nganSachMs: NGAN_SACH_MS, tyLeToiDa: TY_LE_TOI_DA, nguongMs: NGUONG_MS,
                mocCanhBaoSuyGiam: SUY_GIAM_CANH_BAO },
      ketQua,
      theoPool,
      phanQuyet: {
        poolPhanQuyet: POOL_PHAN_QUYET, tongP95CanCu: canCu,
        datNganSachAdr0002: datNganSach, ket: datNganSach ? 'DAT' : 'TRUOT',
      },
      quanSat: {
        suyGiamKhoang, canhBaoSuyGiam,
        choPoolP95XauNhat: choPoolXau, truyVanP95XauNhat: truyVanXau,
        ghiChuNfrPer05: 'NFR-PER-05 là tiêu chí ở mức màn hình (thời gian phản hồi '
          + 'đầu cuối). Phép đo này đo một thành phần nên KHÔNG kết luận đạt/trượt '
          + 'NFR-PER-05. Con số suy giảm ở đây là cảnh báo mang sang WMS-2.',
        khongChamDia: 'EXPLAIN (ANALYZE, BUFFERS) trên bộ 2 triệu dòng cho shared '
          + 'hit, read=0 — toàn bộ tập nóng nằm trong shared_buffers. Phép đo này '
          + 'KHÔNG chạm đĩa lần nào.',
      },
    };
    mkdirSync('evd/WMS-1', { recursive: true });
    writeFileSync('evd/WMS-1/do-p95.json', JSON.stringify(bangChung, null, 2) + '\n');

    console.log(`\n=== PHÁN QUYẾT (lần xấu nhất trên mọi hồ sơ và mọi lần lặp) ===`);
    console.log(`TỔNG p95 (chờ + truy vấn) tại pool ${POOL_PHAN_QUYET}: ${canCu.toFixed(3)} ms`
      + ` / trần ${NGUONG_MS} ms  -> ADR-0002 ${datNganSach ? 'ĐẠT' : 'TRƯỢT'}`);
    console.log(`  thành phần xấu nhất: chờ pool ${choPoolXau.toFixed(3)} ms · `
      + `truy vấn ${truyVanXau.toFixed(3)} ms`);
    console.log(`  theo pool (trung vị / xấu nhất): `
      + theoPool.map((x) => `${x.pool}→${x.tongP95TrungViXau.toFixed(1)}/${x.tongP95XauNhat.toFixed(1)}ms`).join(' · '));
    console.log(`\n--- quan sát, KHÔNG phải phán quyết ---`);
    console.log(`suy giảm khi 200 người, KHOẢNG qua các lần lặp: `
      + `${(suyGiamKhoang[0] * 100).toFixed(0)}–${(suyGiamKhoang[1] * 100).toFixed(0)}%`
      + `${canhBaoSuyGiam ? '  ⚠️  vượt mốc cảnh báo ' + SUY_GIAM_CANH_BAO * 100 + '%' : ''}`);
    console.log(`chờ pool giờ NẰM TRONG phán quyết (A4). Nó vẫn là thành phần lớn nhất,`);
    console.log(`  nên chỉnh pool mới giải quyết được, tối ưu truy vấn thì không.`);
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
