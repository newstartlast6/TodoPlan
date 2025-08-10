import { readFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  
  try {
    // Read and execute the migration
    const migrationPath = join(process.cwd(), 'migrations', '0001_add_timer_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('Running timer tables migration...');
    await sql(migrationSQL);
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();