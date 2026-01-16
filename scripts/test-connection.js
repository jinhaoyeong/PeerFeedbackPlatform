const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['query', 'info', 'warn', 'error']
})

async function main() {
  console.log('Testing database connection...')
  console.log('URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@')) // Hide password
  
  try {
    await prisma.$connect()
    console.log('Successfully connected to database!')
    
    // Try a simple query
    const users = await prisma.user.findMany({ take: 1 })
    console.log('Connection verified. User count:', users.length)
    
  } catch (e) {
    console.error('Connection failed:')
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
