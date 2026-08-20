// PrismaClient singleton.
// Prisma 7 kết nối qua driver adapter — không còn đọc url từ schema.prisma.
// Next.js dev reload nhiều lần nên phải cache instance trên globalThis, tránh
// mở tràn connection pool.
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL chưa được cấu hình — xem .env.example')
}

// ADR-0002 Sửa đổi 1 chốt kích thước pool là QUYẾT ĐỊNH KIẾN TRÚC, không phải
// tham số vận hành: trần 50 ms của một request gồm cả thời gian chờ lấy kết nối
// (A4), nên con số này quyết định một yêu cầu ưu tiên M đạt hay trượt. Quy tắc là
// ràng buộc TỔNG — số bản sao × pool + dự phòng ≤ max_connections; với
// max_connections = 100 thì 3 bản sao × 20 còn 40 kết nối dự phòng.
// WMS-1 đo ở đúng cấu hình 20 này: p95 tổng 5,2031 ms trên 14.000 request.
// Để mặc định (pg dùng 10) là âm thầm chạy ở một cấu hình CHƯA ai đo.
const POOL_MOI_BAN_SAO = 20

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: POOL_MOI_BAN_SAO }),
  })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
