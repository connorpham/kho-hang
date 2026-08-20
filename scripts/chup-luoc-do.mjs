// Sinh src/lib/__tests__/luoc-do.snapshot.json — ảnh chụp cấu trúc CSDL.
//
// Vì sao tồn tại: reviewer R3 đo được rằng các test cũ canh theo TỪNG ĐỐI TƯỢNG
// được gọi tên, nên 10/12 khoá ngoại, 3/6 chỉ mục unique, và cả bảng `phien` gỡ
// được mà 38/38 vẫn xanh. Danh sách cấm không bắt được thứ chưa ai gọi tên; ảnh
// chụp tập thì bắt.
//
//   node --env-file-if-exists=.env scripts/chup-luoc-do.mjs
//
// Chạy lại SAU KHI cố ý đổi lược đồ, và diff của fixture phải đi qua review.
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'

const c = new Client({ connectionString: process.env.DATABASE_URL })
await c.connect()
const q = async (s) => (await c.query(s)).rows

const cot = await q(`
  SELECT table_name || '.' || column_name || ' ' || udt_name ||
         -- Độ dài PHẢI nằm trong ảnh chụp: udt_name của varchar(255) và
         -- varchar(60) giống hệt nhau, mà băm argon2id thật dài ~97 ký tự nên
         -- thu cột xuống 60 là chặt cụt băm. R3 chỉ ra lỗ này.
         coalesce('(' || character_maximum_length || ')', '') ||
         coalesce('(' || numeric_precision || ',' || numeric_scale || ')', '') ||
         CASE WHEN is_nullable = 'YES' THEN '?' ELSE '' END AS v
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
  ORDER BY table_name, column_name`)

const khoaNgoai = await q(`
  SELECT conrelid::regclass::text || '.' || a.attname || ' -> ' ||
         confrelid::regclass::text || ' ' ||
         CASE confdeltype WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
              WHEN 'a' THEN 'NO ACTION' WHEN 'n' THEN 'SET NULL'
              ELSE confdeltype::text END AS v
  FROM pg_constraint k
  JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
  WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  ORDER BY 1`)

const duyNhat = await q(`
  SELECT indexrelid::regclass::text ||
         CASE WHEN indnullsnotdistinct THEN ' NULLS NOT DISTINCT' ELSE '' END AS v
  FROM pg_index
  WHERE indisunique AND NOT indisprimary
    AND indrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)
  ORDER BY 1`)

const rangBuoc = await q(`
  SELECT conname AS v FROM pg_constraint
  WHERE contype = 'c' AND connamespace = 'public'::regnamespace ORDER BY 1`)

const trigger = await q(`
  SELECT c.relname || '.' || t.tgname || ' ' ||
         CASE t.tgenabled WHEN 'A' THEN 'ALWAYS' WHEN 'O' THEN 'ORIGIN'
              WHEN 'D' THEN 'DISABLED' ELSE t.tgenabled::text END AS v
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
  ORDER BY 1`)

const anh = {
  ghiChu: 'Ảnh chụp lược đồ. Sinh bằng scripts/chup-luoc-do.mjs. Mọi thay đổi ở '
        + 'đây phải là CỐ Ý và phải đi qua review — đó là toàn bộ mục đích của nó.',
  cot: cot.map((r) => r.v),
  khoaNgoai: khoaNgoai.map((r) => r.v),
  chiMucDuyNhat: duyNhat.map((r) => r.v),
  rangBuocCheck: rangBuoc.map((r) => r.v),
  trigger: trigger.map((r) => r.v),
}
writeFileSync('src/lib/__tests__/luoc-do.snapshot.json', JSON.stringify(anh, null, 2) + '\n')
console.log(`ảnh chụp: ${anh.cot.length} cột · ${anh.khoaNgoai.length} khoá ngoại · `
  + `${anh.chiMucDuyNhat.length} chỉ mục duy nhất · ${anh.rangBuocCheck.length} CHECK · `
  + `${anh.trigger.length} trigger`)
await c.end()
