-- DB nháp cho Prisma Migrate phát hiện drift. Bắt buộc phải có vì migration sẽ
-- chứa SQL thủ công (CHECK constraint BRULE-12 và REVOKE UPDATE/DELETE của
-- BRULE-13) mà Prisma không tự sinh được.
CREATE DATABASE stockflow_wms_shadow;
