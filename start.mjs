process.env.NODE_ENV = "production";
process.env.DEMO_MODE = process.env.DEMO_MODE || "true";
if (!process.env.PORT) process.env.PORT = "3000";

const entrypoint = new URL(
  "./Family-Nutrition-Planner/artifacts/api-server/dist/index.mjs",
  import.meta.url
);

try {
  await import(entrypoint.href);
} catch (err) {
  console.error("[FATAL] Server failed to start:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
}
