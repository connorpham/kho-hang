import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Client Prisma sinh tự động — không phải code người viết, không tính coverage.
    exclude: ['src/generated/**', 'node_modules/**', '.next/**'],
  },
})
