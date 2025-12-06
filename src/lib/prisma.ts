// Prisma client workaround for Windows permission issues
import { PrismaClient } from '@prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

const createPrismaClient = () => {
  try {
    const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
    const env = process.env as Record<string, string | undefined>

    const findByFragment = (fragment: string): string | undefined => {
      for (const key of Object.keys(env)) {
        if (key.includes(fragment) && env[key]) return env[key]
      }
      return undefined
    }

    const allowed = (url?: string) => !!url && (
      url.startsWith('postgresql://') ||
      url.startsWith('postgres://') ||
      url.startsWith('prisma://') ||
      url.startsWith('prisma+postgres://')
    )

    let dbUrl = ''
    if (isProd) {
      dbUrl =
        env.POSTGRES_PRISMA_URL ||
        env.POSTGRES_URL_NON_POOLING ||
        env.POSTGRES_URL ||
        env.PRISMA_DATABASE_URL ||
        findByFragment('POSTGRES_PRISMA_URL') ||
        findByFragment('POSTGRES_URL_NON_POOLING') ||
        findByFragment('POSTGRES_URL') ||
        findByFragment('PRISMA_DATABASE_URL') ||
        (allowed(env.DATABASE_URL) ? env.DATABASE_URL as string : '')
    } else {
      dbUrl =
        env.DATABASE_URL ||
        env.POSTGRES_URL ||
        env.POSTGRES_URL_NON_POOLING ||
        env.POSTGRES_PRISMA_URL ||
        env.PRISMA_DATABASE_URL ||
        findByFragment('POSTGRES_URL_NON_POOLING') ||
        findByFragment('POSTGRES_URL') ||
        findByFragment('POSTGRES_PRISMA_URL') ||
        findByFragment('PRISMA_DATABASE_URL') ||
        ''
      if (!dbUrl) {
        dbUrl = 'file:./dev.db'
      }
      ;(process.env as any).DATABASE_URL = dbUrl
    }

    if (isProd) {
      if (!allowed(dbUrl)) {
        const candidate =
          env.POSTGRES_PRISMA_URL ||
          env.POSTGRES_URL_NON_POOLING ||
          env.POSTGRES_URL ||
          env.PRISMA_DATABASE_URL ||
          env.DATABASE_URL ||
          ''
        if (candidate) {
          ;(process.env as any).DATABASE_URL = candidate
        } else {
          throw new Error('DATABASE_URL must be a Postgres/Prisma connection string in production.')
        }
      } else {
        ;(process.env as any).DATABASE_URL = dbUrl
      }
    }

    return new PrismaClient({
      datasources: {
        db: { url: (process.env.DATABASE_URL as string) || dbUrl }
      },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
    })
  } catch (error) {
    console.error('Failed to create Prisma client:', error)
    console.error('Please check your DATABASE_URL and run: npm run db:push')
    // Return a mock client that prevents crashes
    const mockClient = {
      $disconnect: async () => {},
      $connect: async () => {},
      user: {
        findUnique: async () => null,
        findMany: async () => [],
        findFirst: async () => null,
        create: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        update: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        delete: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        count: async () => 0
      },
      notification: {
        findMany: async () => [],
        create: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        update: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        delete: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        count: async () => 0
      },
      group: {
        findUnique: async () => null,
        findMany: async () => [],
        create: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        update: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        delete: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
      },
      groupMember: {
        findMany: async () => [],
        findUnique: async () => null,
        create: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        update: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        delete: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
      },
      feedbackSubmission: {
        findMany: async () => [],
        create: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        update: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        delete: async () => { throw new Error('Database connection failed. Check DATABASE_URL configuration.') },
        count: async () => 0
      }
    }
    return mockClient as any
  }
}

export const prisma = globalThis.__prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
