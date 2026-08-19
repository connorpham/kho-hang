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

function createClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
