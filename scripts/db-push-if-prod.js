const { spawnSync } = require('child_process')

const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL

if (isProd) {
  // Ensure Prisma CLI has a valid DATABASE_URL in production
  const envVars = process.env
  const findByFragment = (fragment) => {
  for (const key of Object.keys(envVars)) {
      if (key.includes(fragment) && envVars[key]) return envVars[key]
    }
    return undefined
  }

  const dbUrl =
    envVars.POSTGRES_URL_NON_POOLING ||
    envVars.POSTGRES_URL ||
    envVars.DATABASE_URL ||
    findByFragment('POSTGRES_URL_NON_POOLING') ||
    findByFragment('POSTGRES_URL') ||
    findByFragment('DATABASE_URL') ||
    ''

  if (!dbUrl) {
    console.warn('⚠️  No Postgres URL found (POSTGRES_URL/POSTGRES_URL_NON_POOLING/DATABASE_URL). Skipping Prisma db push, continuing build.')
    process.exit(0)
  }

  const cliEnv = { ...process.env, DATABASE_URL: dbUrl }

  console.log('🔄 Running Prisma db push for production...')
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
    stdio: 'inherit',
    env: cliEnv,
  })
  if (result.status !== 0) {
    console.error('❌ Prisma db push failed')
    process.exit(result.status || 1)
  }
  console.log('✅ Prisma db push completed')
} else {
  console.log('ℹ️  Skipping Prisma db push (non-production build)')
}
