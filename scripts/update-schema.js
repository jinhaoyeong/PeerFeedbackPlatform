const fs = require('fs');
const path = require('path');

// Configuration
const PRISMA_DIR = path.join(__dirname, '..', 'prisma');
const SCHEMA_PATH = path.join(PRISMA_DIR, 'schema.prisma');
const POSTGRES_SCHEMA_PATH = path.join(PRISMA_DIR, 'schema.postgres.prisma');

async function updateSchemaForProduction() {
  console.log('🔄 Checking environment...');
  console.log('ENV: VERCEL=', process.env.VERCEL);
  console.log('ENV: NODE_ENV=', process.env.NODE_ENV);
  console.log('ENV: CI=', process.env.CI);
  
  // Check if we are in a production environment (like Vercel)
  // We check for VERCEL env var or CI env var to be safer
  if (process.env.VERCEL || process.env.CI || process.env.NODE_ENV === 'production') {
    console.log('🚀 Detected production/CI environment. Switching to PostgreSQL schema...');
    
    if (fs.existsSync(POSTGRES_SCHEMA_PATH)) {
      try {
        // Read content first to ensure we can read it
        const postgresSchema = fs.readFileSync(POSTGRES_SCHEMA_PATH, 'utf8');
        
        // Write to schema.prisma
        fs.writeFileSync(SCHEMA_PATH, postgresSchema);
        console.log('✅ Updated prisma/schema.prisma with PostgreSQL configuration.');
        
        // Verify the file content starts with postgresql provider
        const content = fs.readFileSync(SCHEMA_PATH, 'utf8');
        if (content.includes('provider = "postgresql"')) {
            console.log('✅ Verification successful: Provider is now postgresql');
        } else {
            console.warn('⚠️ Warning: File updated but provider might still be incorrect');
        }
      } catch (error) {
        console.error('❌ Error updating schema:', error);
        process.exit(1);
      }
    } else {
      console.error('❌ Error: prisma/schema.postgres.prisma not found at:', POSTGRES_SCHEMA_PATH);
      console.log('Contents of prisma dir:', fs.readdirSync(PRISMA_DIR));
      process.exit(1);
    }
  } else {
    console.log('💻 Detected local/development environment. Keeping SQLite schema.');
  }
}

updateSchemaForProduction();
