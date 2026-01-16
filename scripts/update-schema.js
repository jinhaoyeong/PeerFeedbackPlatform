const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PRISMA_DIR = path.join(__dirname, '..', 'prisma');
const SCHEMA_PATH = path.join(PRISMA_DIR, 'schema.prisma');
const POSTGRES_SCHEMA_PATH = path.join(PRISMA_DIR, 'schema.postgres.prisma');

async function updateSchemaForProduction() {
  console.log('🔄 Checking environment...');
  
  // Check if we are in a production environment (like Vercel)
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.log('🚀 Detected production environment. Switching to PostgreSQL schema...');
    
    if (fs.existsSync(POSTGRES_SCHEMA_PATH)) {
      // Backup original schema just in case (though mostly ephemeral in CI/CD)
      // fs.copyFileSync(SCHEMA_PATH, SCHEMA_PATH + '.backup');
      
      // Overwrite schema.prisma with schema.postgres.prisma
      fs.copyFileSync(POSTGRES_SCHEMA_PATH, SCHEMA_PATH);
      console.log('✅ Updated prisma/schema.prisma with PostgreSQL configuration.');
    } else {
      console.error('❌ Error: prisma/schema.postgres.prisma not found!');
      process.exit(1);
    }
  } else {
    console.log('💻 Detected local/development environment. Keeping SQLite schema.');
  }
}

updateSchemaForProduction();
