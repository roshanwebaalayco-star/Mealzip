import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Local PostgreSQL pool — used for read-only recipe/ICMR data and health checks
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Local DB (recipes, icmr_nin_rda — stays local for fast full-text search)
export const localDb = drizzle(pool, { schema });

// Supabase (Singapore AP region) — for all user data tables.
// Falls back to local PostgreSQL when SUPABASE_DATABASE_URL is not set (dev/test).
// NOTE: ssl.rejectUnauthorized=false is required for Supabase's connection pooler (Supavisor).
// The pooler terminates TLS with a certificate that includes self-signed intermediaries
// not present in the Node.js/system trust store. Connection traffic is still encrypted;
// the restriction is on certificate chain validation only. This is the documented Supabase
// approach for pooler connections (https://supabase.com/docs/guides/database/connecting-to-postgres).
const supabaseUrl = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
const isSupabase = supabaseUrl !== process.env.DATABASE_URL;
export const supabasePool = new Pool({
  connectionString: supabaseUrl,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(supabasePool, { schema });

export * from "./schema";
