// ── Port must be 3000 ──────────────────────────────────────────────────────
// Replit routes all external traffic to localPort=3000 (see [[ports]] in .replit).
// Cloud Run may inject PORT=8080 via its own env, which would cause a mismatch.
// We always override to 3000 so the server and the health-check probe agree.
process.env.PORT = "3000";
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.DEMO_MODE = process.env.DEMO_MODE || "true";

console.log("[start] NutriNext server initializing");
console.log("[start] PORT    :", process.env.PORT);
console.log("[start] NODE_ENV:", process.env.NODE_ENV);

const entrypoint = new URL(
  "./Family-Nutrition-Planner/artifacts/api-server/dist/index.mjs",
  import.meta.url
);

console.log("[start] Bundle  :", entrypoint.pathname);

try {
  await import(entrypoint.href);
  console.log("[start] Bundle loaded — server is up.");
} catch (err) {
  console.error("[FATAL] Server failed to start:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
}
