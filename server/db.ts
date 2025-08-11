import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
import * as schema from "@shared/schema";

// Lazy, environment-aware Postgres client for Supabase/Neon/etc.
// Only initializes when STORAGE_BACKEND=postgres. In memory mode, this module has no side effects.

let pool: InstanceType<typeof Pool> | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

function normalizeDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    // Ensure SSL for Supabase by default (direct or pooler hosts)
    if ((/supabase\.(co|com)$/i.test(u.hostname) || u.hostname.includes("supabase.com") || u.hostname.includes("supabase.co"))
      && !u.searchParams.has("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function isPostgresMode(): boolean {
  const backend = process.env.STORAGE_BACKEND || "";
  if (backend) return backend === "postgres";
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!isPostgresMode()) {
    throw new Error("Database requested while STORAGE_BACKEND is not 'postgres'");
  }

  if (dbInstance) return dbInstance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required when STORAGE_BACKEND=postgres");
  }

  const connectionString = normalizeDatabaseUrl(url);

  // For Supabase hosts, relax TLS verification to avoid self-signed chain errors
  // This mirrors our migration/seed behavior and only applies when sslmode=require is present
  if (connectionString.includes("supabase.") && connectionString.includes("sslmode=require")) {
    if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
  }

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });
  dbInstance = drizzle(pool, { schema });
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}
