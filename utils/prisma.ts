import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
ssl: { rejectUnauthorized: false },
})

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
