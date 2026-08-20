-- ════════════════════════════════════════════════════════════════════════════
-- BỌC TRANSACTION — reviewer R2 chứng minh vì sao bắt buộc
-- Prisma bắn từng câu lệnh RỜI, mỗi câu autocommit. R2 chèn một lỗi ở cuối file
-- rồi `migrate deploy` lên CSDL trắng: 12 bảng + toàn bộ seed ĐÃ COMMIT, còn
-- _prisma_migrations thì finished_at=NULL. Đường phục hồi chính thức
-- (`migrate resolve --rolled-back` rồi deploy lại) cũng tắc với 42P07
-- "already exists". Bọc BEGIN/COMMIT thì cùng kịch bản đó chỉ còn 1 bảng.
--
-- ĐỪNG biến thành luật mù cho mọi migration: CREATE INDEX CONCURRENTLY,
-- ALTER TYPE ... ADD VALUE, và phân vùng theo tháng của OPN-03 đều KHÔNG chạy
-- được trong transaction. Luật là "bọc trừ khi có câu lệnh không cho phép".
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- CreateTable
CREATE TABLE "so_du_ton_kho" (
    "id" BIGSERIAL NOT NULL,
    "san_pham_id" BIGINT NOT NULL,
    "kho_id" BIGINT NOT NULL,
    "vi_tri_id" BIGINT NOT NULL,
    "lo_id" BIGINT,
    "so_luong_thuc_te" DECIMAL(18,3) NOT NULL,
    "so_luong_phan_bo" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "so_luong_cho_qc" DECIMAL(18,3) NOT NULL,
    "so_luong_cach_ly" DECIMAL(18,3) NOT NULL,
    "so_luong_khoa" DECIMAL(18,3) NOT NULL,
    "so_luong_kha_dung" DECIMAL(18,3) NOT NULL,
    "cap_nhat_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phien_ban" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "so_du_ton_kho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chuyen_dong_kho" (
    "id" BIGSERIAL NOT NULL,
    "loai_giao_dich" VARCHAR(30) NOT NULL,
    "san_pham_id" BIGINT NOT NULL,
    "kho_id" BIGINT NOT NULL,
    "vi_tri_id" BIGINT NOT NULL,
    "lo_id" BIGINT,
    "serial_item_id" BIGINT,
    "so_luong" DECIMAL(18,3) NOT NULL,
    "ton_truoc" DECIMAL(18,3) NOT NULL,
    "ton_sau" DECIMAL(18,3) NOT NULL,
    "loai_chung_tu" VARCHAR(30) NOT NULL,
    "chung_tu_id" BIGINT NOT NULL,
    "ly_do_id" BIGINT,
    "nguoi_thuc_hien_id" BIGINT NOT NULL,
    "thoi_diem" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chuyen_dong_kho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kho" (
    "id" BIGSERIAL NOT NULL,
    "ma" VARCHAR(20) NOT NULL,
    "ten" VARCHAR(200) NOT NULL,
    "dang_hoat_dong" BOOLEAN NOT NULL DEFAULT true,
    "tao_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vai_tro" (
    "id" SERIAL NOT NULL,
    "ma" VARCHAR(20) NOT NULL,
    "ten" VARCHAR(100) NOT NULL,
    "la_mac_dinh" BOOLEAN NOT NULL DEFAULT false,
    "tao_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vai_tro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quyen" (
    "id" SERIAL NOT NULL,
    "man_hinh" VARCHAR(10) NOT NULL,
    "hanh_dong" VARCHAR(20) NOT NULL,

    CONSTRAINT "quyen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vai_tro_quyen" (
    "vai_tro_id" INTEGER NOT NULL,
    "quyen_id" INTEGER NOT NULL,

    CONSTRAINT "vai_tro_quyen_pkey" PRIMARY KEY ("vai_tro_id","quyen_id")
);

-- CreateTable
CREATE TABLE "nguoi_dung" (
    "id" BIGSERIAL NOT NULL,
    "ten_dang_nhap" VARCHAR(50) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "ho_ten" VARCHAR(200) NOT NULL,
    "mat_khau_hash" VARCHAR(255) NOT NULL,
    "mat_khau_doi_luc" TIMESTAMPTZ(3),
    "dang_hoat_dong" BOOLEAN NOT NULL DEFAULT true,
    "so_lan_sai_lien_tiep" INTEGER NOT NULL DEFAULT 0,
    "sai_dau_tien_luc" TIMESTAMPTZ(3),
    "khoa_den_luc" TIMESTAMPTZ(3),
    "tao_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nguoi_dung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nguoi_dung_vai_tro" (
    "nguoi_dung_id" BIGINT NOT NULL,
    "vai_tro_id" INTEGER NOT NULL,

    CONSTRAINT "nguoi_dung_vai_tro_pkey" PRIMARY KEY ("nguoi_dung_id","vai_tro_id")
);

-- CreateTable
CREATE TABLE "nguoi_dung_kho" (
    "nguoi_dung_id" BIGINT NOT NULL,
    "kho_id" BIGINT NOT NULL,

    CONSTRAINT "nguoi_dung_kho_pkey" PRIMARY KEY ("nguoi_dung_id","kho_id")
);

-- CreateTable
CREATE TABLE "phien" (
    "id" VARCHAR(64) NOT NULL,
    "nguoi_dung_id" BIGINT NOT NULL,
    "kho_hien_tai_id" BIGINT,
    "tao_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "thao_tac_cuoi_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "het_han_luc" TIMESTAMPTZ(3) NOT NULL,
    "dia_chi_ip" INET NOT NULL,

    CONSTRAINT "phien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nhat_ky_thao_tac" (
    "id" BIGSERIAL NOT NULL,
    "nguoi_dung_id" BIGINT,
    "ten_dang_nhap_luc_ghi" VARCHAR(50) NOT NULL,
    "hanh_dong" VARCHAR(30) NOT NULL,
    "loai_doi_tuong" VARCHAR(50) NOT NULL,
    "doi_tuong_id" BIGINT,
    "gia_tri_truoc" JSONB,
    "gia_tri_sau" JSONB,
    "dia_chi_ip" INET NOT NULL,
    "thoi_diem" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhat_ky_thao_tac_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "so_du_ton_kho_san_pham_id_kho_id_vi_tri_id_lo_id_key" ON "so_du_ton_kho"("san_pham_id", "kho_id", "vi_tri_id", "lo_id");

-- CreateIndex
CREATE INDEX "chuyen_dong_kho_san_pham_id_kho_id_thoi_diem_idx" ON "chuyen_dong_kho"("san_pham_id", "kho_id", "thoi_diem");

-- CreateIndex
CREATE INDEX "chuyen_dong_kho_loai_chung_tu_chung_tu_id_idx" ON "chuyen_dong_kho"("loai_chung_tu", "chung_tu_id");

-- CreateIndex
CREATE UNIQUE INDEX "kho_ma_key" ON "kho"("ma");

-- CreateIndex
CREATE UNIQUE INDEX "vai_tro_ma_key" ON "vai_tro"("ma");

-- CreateIndex
CREATE UNIQUE INDEX "quyen_man_hinh_hanh_dong_key" ON "quyen"("man_hinh", "hanh_dong");

-- CreateIndex
CREATE UNIQUE INDEX "nguoi_dung_ten_dang_nhap_key" ON "nguoi_dung"("ten_dang_nhap");

-- CreateIndex
CREATE UNIQUE INDEX "nguoi_dung_email_key" ON "nguoi_dung"("email");

-- CreateIndex
CREATE INDEX "phien_het_han_luc_idx" ON "phien"("het_han_luc");

-- CreateIndex
CREATE INDEX "nhat_ky_thao_tac_nguoi_dung_id_thoi_diem_idx" ON "nhat_ky_thao_tac"("nguoi_dung_id", "thoi_diem");

-- CreateIndex
CREATE INDEX "nhat_ky_thao_tac_loai_doi_tuong_doi_tuong_id_idx" ON "nhat_ky_thao_tac"("loai_doi_tuong", "doi_tuong_id");

-- CreateIndex
CREATE INDEX "nhat_ky_thao_tac_thoi_diem_idx" ON "nhat_ky_thao_tac"("thoi_diem");

-- AddForeignKey
ALTER TABLE "so_du_ton_kho" ADD CONSTRAINT "so_du_ton_kho_kho_id_fkey" FOREIGN KEY ("kho_id") REFERENCES "kho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chuyen_dong_kho" ADD CONSTRAINT "chuyen_dong_kho_kho_id_fkey" FOREIGN KEY ("kho_id") REFERENCES "kho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chuyen_dong_kho" ADD CONSTRAINT "chuyen_dong_kho_nguoi_thuc_hien_id_fkey" FOREIGN KEY ("nguoi_thuc_hien_id") REFERENCES "nguoi_dung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vai_tro_quyen" ADD CONSTRAINT "vai_tro_quyen_vai_tro_id_fkey" FOREIGN KEY ("vai_tro_id") REFERENCES "vai_tro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vai_tro_quyen" ADD CONSTRAINT "vai_tro_quyen_quyen_id_fkey" FOREIGN KEY ("quyen_id") REFERENCES "quyen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nguoi_dung_vai_tro" ADD CONSTRAINT "nguoi_dung_vai_tro_nguoi_dung_id_fkey" FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nguoi_dung_vai_tro" ADD CONSTRAINT "nguoi_dung_vai_tro_vai_tro_id_fkey" FOREIGN KEY ("vai_tro_id") REFERENCES "vai_tro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nguoi_dung_kho" ADD CONSTRAINT "nguoi_dung_kho_nguoi_dung_id_fkey" FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nguoi_dung_kho" ADD CONSTRAINT "nguoi_dung_kho_kho_id_fkey" FOREIGN KEY ("kho_id") REFERENCES "kho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phien" ADD CONSTRAINT "phien_nguoi_dung_id_fkey" FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phien" ADD CONSTRAINT "phien_kho_hien_tai_id_fkey" FOREIGN KEY ("kho_hien_tai_id") REFERENCES "kho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nhat_ky_thao_tac" ADD CONSTRAINT "nhat_ky_thao_tac_nguoi_dung_id_fkey" FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- PHẦN VIẾT TAY — Prisma không sinh được. WMS-2 · ADR-0003.
-- ════════════════════════════════════════════════════════════════════════════

-- ── DI-01 / BRULE-12: sáu cột số lượng của so_du_ton_kho phải >= 0 ──────────
-- SRS §5.3 DI-01 nói rõ "thực thi bằng ràng buộc kiểm tra ở CẤP CƠ SỞ DỮ LIỆU".
-- Cả 6 cột đều NOT NULL nên không có đường "CHECK trả NULL ⇒ PASS" (R2 đã truy
-- pg_attribute xác nhận).
-- GIỚI HẠN ĐÃ BIẾT: đây là ràng buộc TỪNG CỘT, không phải bất biến. Bộ ba
-- (thuc_te=10, phan_bo=9999, kha_dung=88888) vẫn lọt — công thức BRULE-11 và
-- quan hệ phan_bo <= thuc_te KHÔNG được canh ở đây. Chỗ canh chúng là giao dịch
-- ghi tồn (DC-05), thuộc ticket có luồng nhập/xuất.
ALTER TABLE "so_du_ton_kho"
  ADD CONSTRAINT "so_du_ton_kho_khong_am" CHECK (
    "so_luong_thuc_te"  >= 0 AND "so_luong_phan_bo" >= 0 AND
    "so_luong_cho_qc"   >= 0 AND "so_luong_cach_ly" >= 0 AND
    "so_luong_khoa"     >= 0 AND "so_luong_kha_dung" >= 0
  );

-- ── BRULE-11 / DI-03: một tổ hợp khoá chỉ được có MỘT dòng số dư ────────────
-- Prisma sinh UNIQUE mặc định NULLS DISTINCT, nên với sản phẩm KHÔNG truy vết
-- theo lô (lo_id IS NULL) thì hai dòng số dư y hệt cùng tồn tại được — R2 chèn
-- thật và nhận INSERT 0 1 hai lần. Điều đó vỡ BRULE-11 và vỡ đối soát DI-03
-- trước khi có dòng dữ liệu nào. Prisma 7 không diễn đạt được NULLS NOT
-- DISTINCT nên index phải nằm ở đây.
DROP INDEX IF EXISTS "so_du_ton_kho_san_pham_id_kho_id_vi_tri_id_lo_id_key";
CREATE UNIQUE INDEX "so_du_ton_kho_to_hop_khoa"
  ON "so_du_ton_kho" ("san_pham_id", "kho_id", "vi_tri_id", "lo_id") NULLS NOT DISTINCT;

-- ── DI-02: ton_sau - ton_truoc phải bằng đúng so_luong ──────────────────────
-- QUY ƯỚC DẤU mà ràng buộc này áp đặt, nói rõ vì tác vụ đối soát DI-03 sẽ ghi
-- bằng SQL thuần: so_luong DƯƠNG là tăng, ÂM là giảm. Một phiếu xuất 3 đơn vị
-- phải ghi so_luong = -3 (10 → 7), ghi +3 sẽ bị 23514.
ALTER TABLE "chuyen_dong_kho"
  ADD CONSTRAINT "chuyen_dong_kho_can_doi" CHECK ("ton_sau" - "ton_truoc" = "so_luong");

-- Sổ chuyển động không được ghi lại một mức tồn âm: DI-01 cấm tồn âm ở bảng số
-- dư, mà DC-05 bắt hai bảng phải khớp trong CÙNG một giao dịch.
ALTER TABLE "chuyen_dong_kho"
  ADD CONSTRAINT "chuyen_dong_kho_ton_sau_khong_am" CHECK ("ton_sau" >= 0);

-- ── BRULE-13 / DI-07: hai bảng CHỈ GHI THÊM ─────────────────────────────────
-- NÓI ĐÚNG THỨ CƠ CHẾ NÀY LÀM ĐƯỢC. Bản đầu viết "trigger chặn mọi vai trò, kể
-- cả superuser" — SAI, và reviewer R2 phá được bằng sáu đường. Sự thật:
--   CHẶN được : UPDATE, DELETE thường (mọi vai trò), và TRUNCATE.
--   KHÔNG chặn: chủ sở hữu bảng DROP TRIGGER / ALTER TABLE DISABLE TRIGGER /
--               CREATE OR REPLACE hàm này / DROP TABLE. Về bản chất không có
--               trigger nào chặn được chủ sở hữu — chỗ đó phải giải bằng quyền
--               (chủ sở hữu bảng KHÁC vai trò ứng dụng), và việc đó phụ thuộc
--               OPN-03. SQL để làm khi OPN-03 chốt:
--                 REVOKE UPDATE, DELETE, TRUNCATE ON chuyen_dong_kho,
--                        nhat_ky_thao_tac FROM <vai_tro_ung_dung>;
-- ENABLE ALWAYS: không có nó thì `SET session_replication_role='replica'` tắt
-- trigger — R2 chạy được DELETE bằng đúng đường đó.
CREATE OR REPLACE FUNCTION chan_sua_xoa() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'bang % chi duoc ghi them: thao tac % bi chan (BRULE-13 / DI-07)',
    TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "chuyen_dong_kho_chi_ghi_them"
  BEFORE UPDATE OR DELETE ON "chuyen_dong_kho"
  FOR EACH ROW EXECUTE FUNCTION chan_sua_xoa();
CREATE TRIGGER "chuyen_dong_kho_chan_truncate"
  BEFORE TRUNCATE ON "chuyen_dong_kho"
  FOR EACH STATEMENT EXECUTE FUNCTION chan_sua_xoa();
ALTER TABLE "chuyen_dong_kho" ENABLE ALWAYS TRIGGER "chuyen_dong_kho_chi_ghi_them";
ALTER TABLE "chuyen_dong_kho" ENABLE ALWAYS TRIGGER "chuyen_dong_kho_chan_truncate";

CREATE TRIGGER "nhat_ky_thao_tac_chi_ghi_them"
  BEFORE UPDATE OR DELETE ON "nhat_ky_thao_tac"
  FOR EACH ROW EXECUTE FUNCTION chan_sua_xoa();
CREATE TRIGGER "nhat_ky_thao_tac_chan_truncate"
  BEFORE TRUNCATE ON "nhat_ky_thao_tac"
  FOR EACH STATEMENT EXECUTE FUNCTION chan_sua_xoa();
ALTER TABLE "nhat_ky_thao_tac" ENABLE ALWAYS TRIGGER "nhat_ky_thao_tac_chi_ghi_them";
ALTER TABLE "nhat_ky_thao_tac" ENABLE ALWAYS TRIGGER "nhat_ky_thao_tac_chan_truncate";

-- ── NFR-SEC-03: mat_khau_hash phải LÀ một chuỗi băm, không phải mật khẩu ────
-- NFR-SEC-03 viết "tuyệt đối không lưu ở dạng rõ hay mã hoá hai chiều". Trước
-- ràng buộc này KHÔNG có gì thi hành câu đó: reviewer R3 nhét thẳng chuỗi rõ
-- 'MatKhau@123' vào cột và cả 27 test vẫn xanh.
-- Cho phép ĐÚNG BA họ thuật toán mà NFR-SEC-03 nêu tên, không hơn:
--   bcrypt  $2a$ / $2b$ / $2y$      scrypt  $scrypt$      Argon2  $argon2i|d|id$
-- Chặn hẹp hơn (ví dụ chỉ Argon2) là tự thu hẹp spec; chặn rộng hơn thì không
-- chặn gì. Đây là ràng buộc ĐỊNH DẠNG — nó không chứng minh được chuỗi kia là
-- băm THẬT của mật khẩu nào; việc đó thuộc ticket có mã xác thực (WMS-3).
ALTER TABLE "nguoi_dung"
  ADD CONSTRAINT "nguoi_dung_mat_khau_phai_la_bam" CHECK (
    "mat_khau_hash" ~ '^\$(2[aby]\$|scrypt\$|argon2(id|i|d)\$)'
  );

-- ── FR-20-02: danh mục quyền = 20 màn hình × 6 hành động ────────────────────
-- ON CONFLICT: chạy lại khối này không được nổ. R2 chỉ ra bản đầu không
-- idempotent, và chính điều đó khoá chết đường phục hồi khi migration hỏng dở.
INSERT INTO "quyen" ("man_hinh", "hanh_dong")
SELECT 'SC-' || lpad(g::text, 2, '0'), h
FROM generate_series(1, 20) g
CROSS JOIN unnest(ARRAY['XEM','TAO','SUA','XOA','PHE_DUYET','KET_XUAT']) h
ON CONFLICT ("man_hinh", "hanh_dong") DO NOTHING;

-- ── SRS §8 + §2.2: 10 vai trò mặc định ──────────────────────────────────────
-- Bản đầu chỉ seed 9. §8 ghi chú rằng "Kiểm toán nội bộ" không nằm trong bảng vì
-- được cấp quyền chỉ đọc trên toàn bộ màn hình — nhưng §2.2 vẫn liệt kê nó là
-- một nhóm người dùng, và FR-20-03 đòi vai trò mẫu cho MỌI nhóm ở §2.2.
INSERT INTO "vai_tro" ("ma", "ten", "la_mac_dinh") VALUES
  ('QTHT', 'Quản trị hệ thống',    true), ('QLK',  'Quản lý kho',          true),
  ('TK',   'Thủ kho',              true), ('NVK',  'Nhân viên kho',        true),
  ('QC',   'Kiểm soát chất lượng', true), ('MH',   'Mua hàng',             true),
  ('KD',   'Kinh doanh',           true), ('KT',   'Kế toán',              true),
  ('CSKH', 'Chăm sóc khách hàng',  true), ('KTNB', 'Kiểm toán nội bộ',     true)
ON CONFLICT ("ma") DO NOTHING;

-- ── Gắn quyền: CHỈ QTHT, và chỉ để hệ thống khởi động được ──────────────────
-- Quyết định của chủ dự án 2026-08-20 (xem docs/pm/decisions.md).
-- Vấn đề mà nó giải: NFR-SEC-04 bắt phân quyền thực thi ở tầng máy chủ cho mọi
-- điểm cuối. Nếu KHÔNG vai trò nào có quyền thì QTHT cũng không vào được SC-20 —
-- đúng màn hình duy nhất được chỉ định (FR-20-02) để cấu hình ma trận. Hệ thống
-- tự khoá mình lúc khởi tạo. Reviewer R1 chỉ ra deadlock này.
-- Vì sao KHÔNG seed cả ma trận §8: 171 ô F/C/A/R là nội dung spec, mà Q3+Q4 giữ
-- toàn bộ tầng spec ngoài repo public. Một dòng "QTHT toàn quyền" không để lộ
-- ma trận theo từng vai trò.
-- HỆ QUẢ NÓI THẲNG: 9 vai trò còn lại vẫn CHƯA CÓ quyền nào, nên AC3 của WMS-2
-- ("vai trò mặc định THEO MA TRẬN §8") vẫn CHƯA ĐẠT TRỌN. Việc gắn phần còn lại
-- là của SC-20 hoặc một seed cục bộ không commit.
INSERT INTO "vai_tro_quyen" ("vai_tro_id", "quyen_id")
SELECT v.id, q.id FROM "vai_tro" v CROSS JOIN "quyen" q WHERE v.ma = 'QTHT'
ON CONFLICT DO NOTHING;

COMMIT;
