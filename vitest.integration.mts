// Cấu hình riêng cho test TÍCH HỢP — loại test cần một PostgreSQL thật.
//
// Vì sao tách khỏi vitest.config.mts: `npm test` phải chạy được ở mọi nơi, kể cả
// CI không có CSDL. Trộn hai loại vào một lệnh thì hoặc CI đỏ vì thiếu DB, hoặc
// phải bỏ qua bằng điều kiện — và một test tự bỏ qua là một test luôn xanh.
// Bước `integration` trong gates.yaml là bước `tail`: chỉ chạy khi gọi `gate e2e`.
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.itest.ts'],
    // Chạy tuần tự: các test này dùng chung một CSDL, chạy song song là tự tạo
    // ra lỗi giả không liên quan tới thứ đang kiểm.
    fileParallelism: false,
    testTimeout: 20_000,
  },
})
