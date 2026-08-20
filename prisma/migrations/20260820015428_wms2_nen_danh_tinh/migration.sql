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
    "cap_nhat_luc" TIMESTAMP(3) NOT NULL,
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
    "thoi_diem" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chuyen_dong_kho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kho" (
    "id" BIGSERIAL NOT NULL,
    "ma" VARCHAR(20) NOT NULL,
    "ten" VARCHAR(200) NOT NULL,
    "dang_hoat_dong" BOOLEAN NOT NULL DEFAULT true,
    "tao_luc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vai_tro" (
    "id" SERIAL NOT NULL,
    "ma" VARCHAR(20) NOT NULL,
    "ten" VARCHAR(100) NOT NULL,
    "la_mac_dinh" BOOLEAN NOT NULL DEFAULT false,
    "tao_luc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "mat_khau_doi_luc" TIMESTAMP(3),
    "dang_hoat_dong" BOOLEAN NOT NULL DEFAULT true,
    "so_lan_sai_lien_tiep" INTEGER NOT NULL DEFAULT 0,
    "sai_dau_tien_luc" TIMESTAMP(3),
    "khoa_den_luc" TIMESTAMP(3),
    "tao_luc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMP(3) NOT NULL,

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
    "tao_luc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "thao_tac_cuoi_luc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "het_han_luc" TIMESTAMP(3) NOT NULL,
    "dia_chi_ip" INET NOT NULL,

    CONSTRAINT "phien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nhat_ky_thao_tac" (
    "id" BIGSERIAL NOT NULL,
    "nguoi_dung_id" BIGINT NOT NULL,
    "ten_dang_nhap_luc_ghi" VARCHAR(50) NOT NULL,
    "hanh_dong" VARCHAR(30) NOT NULL,
    "loai_doi_tuong" VARCHAR(50) NOT NULL,
    "doi_tuong_id" BIGINT,
    "gia_tri_truoc" JSONB,
    "gia_tri_sau" JSONB,
    "dia_chi_ip" INET NOT NULL,
    "thoi_diem" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
-- PHẦN VIẾT TAY — Prisma không sinh được, và không được xoá khi sinh lại
-- WMS-2 · ADR-0003. Mỗi khối dưới đây gắn với một quy tắc có mã.
-- ════════════════════════════════════════════════════════════════════════════

-- ── DI-01 / BRULE-12: mọi cột số lượng của so_du_ton_kho phải >= 0 ──────────
-- SRS §5.3 DI-01 nói rõ "được thực thi bằng ràng buộc kiểm tra ở CẤP CƠ SỞ DỮ
-- LIỆU". Kiểm ở tầng ứng dụng (src/lib/ton-kho.ts chanTonAm) là lớp thứ hai, và
-- một mình nó không thoả DI-01: bất kỳ đường ghi nào không đi qua ứng dụng đều
-- lách được.
ALTER TABLE "so_du_ton_kho"
  ADD CONSTRAINT "so_du_ton_kho_khong_am" CHECK (
    "so_luong_thuc_te"  >= 0 AND
    "so_luong_phan_bo"  >= 0 AND
    "so_luong_cho_qc"   >= 0 AND
    "so_luong_cach_ly"  >= 0 AND
    "so_luong_khoa"     >= 0 AND
    "so_luong_kha_dung" >= 0
  );

-- ── DI-02: ton_sau - ton_truoc phải bằng đúng so_luong ──────────────────────
ALTER TABLE "chuyen_dong_kho"
  ADD CONSTRAINT "chuyen_dong_kho_can_doi" CHECK (
    "ton_sau" - "ton_truoc" = "so_luong"
  );

-- ── BRULE-13 / DI-07: hai bảng CHỈ GHI THÊM ─────────────────────────────────
-- BRULE-13 nói "thu hồi quyền UPDATE/DELETE". Ở đây dùng TRIGGER làm lớp cưỡng
-- chế chính, KHÔNG phải REVOKE, và lý do phải nói rõ:
--   * REVOKE không có tác dụng với superuser. Môi trường phát triển hiện tại kết
--     nối bằng `postgres` (xem .env.example), nên chỉ REVOKE là một hàng rào
--     KHÔNG chặn được gì ở chính nơi lập trình viên hay tay trượt nhất.
--   * Trigger chặn mọi vai trò, kể cả superuser.
-- REVOKE cho một vai trò ứng dụng riêng vẫn nên có như lớp phòng thủ thứ hai,
-- nhưng việc tạo vai trò đó là quyết định triển khai và phụ thuộc OPN-03 (hạ
-- tầng chạy thật). SQL để làm khi OPN-03 chốt:
--     REVOKE UPDATE, DELETE ON chuyen_dong_kho, nhat_ky_thao_tac FROM <vai_tro_ung_dung>;
CREATE OR REPLACE FUNCTION chan_sua_xoa() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'bang % chi duoc ghi them: thao tac % bi chan (BRULE-13 / DI-07)',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "chuyen_dong_kho_chi_ghi_them"
  BEFORE UPDATE OR DELETE ON "chuyen_dong_kho"
  FOR EACH ROW EXECUTE FUNCTION chan_sua_xoa();

CREATE TRIGGER "nhat_ky_thao_tac_chi_ghi_them"
  BEFORE UPDATE OR DELETE ON "nhat_ky_thao_tac"
  FOR EACH ROW EXECUTE FUNCTION chan_sua_xoa();

-- ── FR-20-02: danh mục quyền = 20 màn hình × 6 hành động ────────────────────
-- Danh mục này KHÔNG phải nội dung mật: nó chỉ là tích của "SC-01…SC-20" và sáu
-- hành động mà FR-20-02 liệt kê.
INSERT INTO "quyen" ("man_hinh", "hanh_dong")
SELECT 'SC-' || lpad(g::text, 2, '0'), h
FROM generate_series(1, 20) g
CROSS JOIN unnest(ARRAY['XEM','TAO','SUA','XOA','PHE_DUYET','KET_XUAT']) h;

-- ── SRS §8: 9 vai trò mặc định ──────────────────────────────────────────────
INSERT INTO "vai_tro" ("ma", "ten", "la_mac_dinh") VALUES
  ('QTHT', 'Quản trị hệ thống',      true),
  ('QLK',  'Quản lý kho',            true),
  ('TK',   'Thủ kho',                true),
  ('NVK',  'Nhân viên kho',          true),
  ('QC',   'Kiểm soát chất lượng',   true),
  ('MH',   'Mua hàng',               true),
  ('KD',   'Kinh doanh',             true),
  ('KT',   'Kế toán',                true),
  ('CSKH', 'Chăm sóc khách hàng',    true);

-- ── CỐ Ý KHÔNG SEED: ma trận GẮN quyền cho từng vai trò ─────────────────────
-- SRS §8 có bảng đầy đủ (19 màn hình × 9 vai trò với các mức F/C/A/R/–). Bảng đó
-- là NỘI DUNG SPEC, mà quyết định Q3+Q4 giữ toàn bộ tầng spec ngoài repo public.
-- Nhét nó vào migration là công bố spec bằng đường vòng — đúng thứ Q4 chặn.
-- Hệ quả phải nói thẳng: sau migration này, 9 vai trò TỒN TẠI nhưng CHƯA CÓ
-- quyền nào. Điều đó thoả AC của WMS-2 ("các vai trò mặc định đã tồn tại") và
-- KHÔNG thoả nhu cầu vận hành. Gắn quyền là việc của SC-20 (FR-20-02, màn hình
-- quản trị) hoặc của một seed cục bộ không commit. Đã ghi thành việc treo trong
-- docs/pm/decisions.md.
