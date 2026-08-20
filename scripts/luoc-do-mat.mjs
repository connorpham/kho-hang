// Bảy mặt của ảnh chụp lược đồ — CHỈ định nghĩa, KHÔNG tác dụng phụ.
//
// Vì sao tách khỏi chup-luoc-do.mjs: bản trước để `MAT` nằm chung file với mã
// sinh ở cấp cao nhất, nên bộ test `import { MAT }` là chạy luôn trình sinh —
// mỗi lần chạy test, CSDL bị kết nối và **chính file fixture đang được kiểm bị
// ghi đè**. Trên CSDL đã đột biến, fixture sẽ tự được viết lại cho khớp đột biến:
// một test tự chứng nhận chính mình. Tác giả tự bắt được khi thấy dòng log của
// trình sinh in ra giữa output test và mtime của fixture đổi sau mỗi lần chạy.
//
// Luật: file này không được có một dòng nào ngoài định nghĩa.
//
// Phạm vi thành thật: bảy mặt dưới đây, không hơn. CHƯA canh: GRANT/ACL,
// collation, quyền sở hữu, bước nhảy sequence, event trigger, và thân hàm KHÔNG
// phải hàm trigger. Đừng đọc file này như một bảo đảm toàn diện.
export const MAT = {
  bang: `
      -- Mặt MỚI. R3 bật ROW LEVEL SECURITY không kèm policy: 51/51 xanh, nhưng
      -- vai trò ứng dụng (không phải chủ sở hữu) thấy 0 dòng — mất trắng sổ kiểm
      -- toán khi chạy thật. Cũng là mặt bắt DROP TABLE trực tiếp nhất.
      SELECT c.relname ||
             CASE WHEN c.relrowsecurity THEN ' RLS' ELSE '' END ||
             CASE WHEN c.relforcerowsecurity THEN ' FORCE' ELSE '' END AS v
      FROM pg_class c
      WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace
        AND c.relname <> '_prisma_migrations'
      ORDER BY 1`,
  cot: `
      -- Thêm column_default / identity / generated: R3 đổi DEFAULT của
      -- dang_hoat_dong và so_lan_sai_lien_tiep mà ảnh chụp cũ không thấy gì.
      SELECT table_name || '.' || column_name || ' ' || udt_name ||
             coalesce('(' || character_maximum_length || ')', '') ||
             coalesce('(' || numeric_precision || ',' || numeric_scale || ')', '') ||
             CASE WHEN is_nullable = 'YES' THEN '?' ELSE '' END ||
             coalesce(' DEFAULT ' || column_default, '') ||
             CASE WHEN is_identity = 'YES' THEN ' IDENTITY' ELSE '' END ||
             CASE WHEN is_generated <> 'NEVER' THEN ' GENERATED' ELSE '' END AS v
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
      ORDER BY table_name, column_name`,
  khoaChinh: `
      -- Mặt MỚI. Ảnh chụp cũ loại trừ indisprimary, nên gỡ khoá chính của bảng
      -- nối là 51/51 xanh trong khi BR-22 vỡ (3 dòng nguoi_dung_kho trùng nhau).
      SELECT conrelid::regclass::text || ' ' || pg_get_constraintdef(oid) AS v
      FROM pg_constraint WHERE contype = 'p' AND connamespace = 'public'::regnamespace
      ORDER BY 1`,
  khoaNgoai: `
      -- pg_get_constraintdef thay cho việc tự ghép tên: nó gói trọn cột nguồn
      -- (kể cả khoá phức hợp — bản cũ chỉ nhìn conkey[1]), bảng đích, cột đích,
      -- ON DELETE, ON UPDATE, DEFERRABLE, NOT VALID.
      SELECT conrelid::regclass::text || ' ' || pg_get_constraintdef(oid) AS v
      FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace
      ORDER BY 1`,
  chiMucDuyNhat: `
      -- pg_get_indexdef gói trọn CỘT, mệnh đề WHERE của partial index, opclass và
      -- NULLS NOT DISTINCT. Bản cũ chỉ ghi tên, nên dựng lại index cùng tên trên
      -- cột khác, hoặc biến nó thành partial, đều không để lại dấu vết.
      SELECT pg_get_indexdef(indexrelid) AS v FROM pg_index
      WHERE indisunique AND NOT indisprimary
        AND indrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)
      ORDER BY 1`,
  rangBuocCheck: `
      -- Ghi BIỂU THỨC, không chỉ tên: R3 dựng lại chuyen_dong_kho_can_doi giữ
      -- nguyên tên nhưng nới biểu thức, ghi được ton_sau=9999 mà 51/51 vẫn xanh.
      SELECT conrelid::regclass::text || ' ' || conname || ' ' ||
             pg_get_constraintdef(oid) AS v
      FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace
      ORDER BY 1`,
  trigger: `
      -- pg_get_triggerdef gói trọn timing, sự kiện và mệnh đề WHEN (R3 thêm
      -- WHEN (OLD.dia_chi_ip <> …) mà ảnh chụp cũ không thấy). md5(prosrc) ghim
      -- THÂN HÀM — R3 thay chan_sua_xoa() bằng bản có cửa hậu và xoá sạch sổ
      -- kiểm toán trong khi ảnh chụp không đổi một byte.
      SELECT pg_get_triggerdef(t.oid) || ' [' ||
             CASE t.tgenabled WHEN 'A' THEN 'ALWAYS' WHEN 'O' THEN 'ORIGIN'
                  WHEN 'D' THEN 'DISABLED' ELSE t.tgenabled::text END ||
             ' body=' || md5(p.prosrc) || ']' AS v
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_proc  p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
      ORDER BY 1`,
}
