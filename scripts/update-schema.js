const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

try {
  let schema = fs.readFileSync(schemaPath, 'utf8');

  // Only run this if we are in a Vercel environment or explicitly requested
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.log('🔄 Detected Production/Vercel environment. Switching Prisma provider to PostgreSQL...');
    
    // Replace sqlite with postgresql
    schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');
    
    // Write the updated schema back
    fs.writeFileSync(schemaPath, schema);
    console.log('✅ Schema updated to use PostgreSQL');
  } else {
    console.log('ℹ️  Local environment detected. Keeping SQLite provider.');
  }
} catch (error) {
  console.error('❌ Error updating Prisma schema:', error);
  process.exit(1);
}
