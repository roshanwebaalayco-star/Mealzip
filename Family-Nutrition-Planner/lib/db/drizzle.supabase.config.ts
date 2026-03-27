import { defineConfig } from "drizzle-kit";
import path from "path";

const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!supabaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL must be set before running this config");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: supabaseUrl,
    ssl: true,
  },
  out: path.join(__dirname, "./supabase-migrations"),
});
