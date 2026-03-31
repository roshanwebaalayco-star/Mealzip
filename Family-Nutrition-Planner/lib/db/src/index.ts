import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
  const msg =
    "[FATAL] Neither DATABASE_URL nor SUPABASE_DATABASE_URL is set. " +
    "The server cannot connect to the database. " +
    "Ensure this secret is configured in the Deployments → Secrets pane.";
  console.error(msg);
  throw new Error(msg);
}

// Local PostgreSQL pool — used for read-only recipe/ICMR data and health checks
// Higher max: recipes are read-heavy with many concurrent requests
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? process.env.SUPABASE_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000,
});

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
const isSupabase = supabaseUrl?.includes("supabase") ?? false;
export const supabasePool = new Pool({
  connectionString: supabaseUrl,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
export const db = drizzle(supabasePool, { schema });

export * from "./schema";
