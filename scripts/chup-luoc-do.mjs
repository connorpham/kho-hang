// Sinh src/lib/__tests__/luoc-do.snapshot.json — ảnh chụp ĐỊNH NGHĨA của lược đồ.
//
// LẦN VIẾT THỨ HAI. Bản đầu ghi ĐỊNH DANH (tên ràng buộc, tên trigger, tên index)
// mà không ghi ĐỊNH NGHĨA. Reviewer R3 áp 9 phép đột biến cùng lúc rồi chạy lại
// chính script này trên CSDL đã hỏng: KHÔNG MỘT BYTE KHÁC NHAU, 51/51 xanh. Hai
// phép trong đó phá đúng bất biến chỉ-ghi-thêm mà WMS-2 sinh ra để dựng — thay
// thân hàm trigger bằng bản có cửa hậu, và dựng lại CHECK giữ nguyên tên nhưng
// nới biểu thức.
//
// Nay dùng pg_get_constraintdef / pg_get_indexdef / pg_get_triggerdef + md5 thân
// hàm, và thêm mặt khoá chính (bản cũ loại trừ indisprimary hẳn).
//
//   npm run db:snapshot
//
// Chạy lại SAU KHI cố ý đổi lược đồ; diff của fixture phải đi qua review.
//
// Phạm vi thành thật: BẢY mặt dưới đây, không hơn. Những thứ CHƯA được ghi và do
// đó KHÔNG được canh: GRANT/ACL, collation, quyền sở hữu, bước nhảy sequence,
// event trigger, và nội dung thân hàm KHÔNG phải hàm trigger. R3 nêu chúng như
// ứng viên chưa ai đo — đừng đọc file này như một bảo đảm toàn diện.
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'
import { MAT } from './luoc-do-mat.mjs'

const c = new Client({ connectionString: process.env.DATABASE_URL })
await c.connect()
const anh = { ghiChu: 'Ảnh chụp ĐỊNH NGHĨA lược đồ. Sinh bằng npm run db:snapshot. '
  + 'Mọi thay đổi ở đây phải là CỐ Ý và phải đi qua review.' }
for (const [khoa, sql] of Object.entries(MAT)) {
  anh[khoa] = (await c.query(sql)).rows.map((r) => r.v)
}
writeFileSync('src/lib/__tests__/luoc-do.snapshot.json', JSON.stringify(anh, null, 2) + '\n')
console.log(Object.entries(anh).filter(([k]) => k !== 'ghiChu')
  .map(([k, v]) => `${k}=${v.length}`).join(' · '))
await c.end()
