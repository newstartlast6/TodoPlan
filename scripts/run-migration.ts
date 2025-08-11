import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

async function runMigration() {
  // Relax TLS validation for Supabase if necessary
  if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }
  const { connectionString, isSupabase } = (() => {
    try {
      const u = new URL(process.env.DATABASE_URL!);
      const isSupabase = u.hostname.endsWith('supabase.co') || u.hostname.endsWith('supabase.com') || u.hostname.includes('supabase');
      if (isSupabase && !u.searchParams.has('sslmode')) {
        u.searchParams.set('sslmode', 'require');
      }
      return { connectionString: u.toString(), isSupabase };
    } catch {
      return { connectionString: process.env.DATABASE_URL!, isSupabase: /supabase\.(co|com)/.test(process.env.DATABASE_URL!) };
    }
  })();
  const pool = new Pool({
    connectionString,
    ssl: (connectionString.includes('sslmode=require') || isSupabase)
      ? { rejectUnauthorized: false }
      : undefined,
  });
  
  try {
    // Read and execute all SQL migrations in order
    const migrationsDir = join(process.cwd(), 'migrations');
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    console.log(`Running ${files.length} SQL migration(s)...`);
    for (const file of files) {
      const migrationPath = join(migrationsDir, file);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      console.log(`Applying migration: ${file}`);
      const client = await pool.connect();
      try {
        await client.query(migrationSQL);
      } finally {
        client.release();
      }
      console.log(`Applied migration: ${file}`);
    }
    console.log('All migrations completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();