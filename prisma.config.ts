// Prisma 7 config — nơi khai báo URL kết nối cho Migrate/introspect.
// Runtime của app KHÔNG dùng file này; app kết nối qua driver adapter
// (@prisma/adapter-pg) trong src/lib/prisma.ts.
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // DB nháp mà Migrate dùng để phát hiện drift; cần khi CHECK constraint và
    // GRANT của BRULE-12/BRULE-13 được thêm bằng SQL thủ công.
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
})
