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
const supabaseUrl = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
export const supabasePool = new Pool({
  connectionString: supabaseUrl,
  ssl: supabaseUrl !== process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(supabasePool, { schema });

export * from "./schema";
