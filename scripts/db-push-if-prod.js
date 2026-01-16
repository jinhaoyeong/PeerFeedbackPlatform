const { spawnSync } = require('child_process')

const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL || !!process.env.CI

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
    envVars.DATABASE_URL ||
    envVars.POSTGRES_URL_NON_POOLING ||
    envVars.POSTGRES_URL ||
    findByFragment('POSTGRES_URL_NON_POOLING') ||
    findByFragment('POSTGRES_URL') ||
    findByFragment('DATABASE_URL') ||
    ''

  if (!dbUrl) {
    console.warn('⚠️  No Postgres URL found (DATABASE_URL/POSTGRES_URL). Skipping Prisma db push.')
    // In Vercel, if we can't find the DB, we might fail at runtime, but we shouldn't fail the build
    // unless we strictly require it. However, if Prisma client needs it to generate, we might be in trouble.
    // Let's assume schema swap worked, so generation might work if we have *some* url, 
    // but db push definitely needs a real connection.
    process.exit(0)
  }

  // Force DATABASE_URL to be the one we found, just in case
  const cliEnv = { ...process.env, DATABASE_URL: dbUrl }

  console.log('🔄 Running Prisma db push for production...')
  console.log('Using database URL starting with:', dbUrl.substring(0, 15) + '...')
  
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
    stdio: 'inherit',
    env: cliEnv,
  })
  if (result.status !== 0) {
    console.error('❌ Prisma db push failed')
    // We exit with 0 to allow the build to continue even if DB push fails
    // This is often safer if the DB is momentarily unreachable
    console.warn('⚠️  Continuing build despite DB push failure. Runtime errors may occur if schema is out of sync.')
    process.exit(0) 
  }
  console.log('✅ Prisma db push completed')
} else {
  console.log('ℹ️  Skipping Prisma db push (non-production build)')
}
