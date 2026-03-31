console.log("[start] NutriNext server initializing...");
console.log("[start] NODE_ENV:", process.env.NODE_ENV || "(not set, will default to production)");
console.log("[start] PORT:", process.env.PORT || "(not set, will default to 3000)");

process.env.NODE_ENV = "production";
process.env.DEMO_MODE = process.env.DEMO_MODE || "true";
if (!process.env.PORT) process.env.PORT = "3000";

console.log("[start] Resolved PORT:", process.env.PORT);

const entrypoint = new URL(
  "./Family-Nutrition-Planner/artifacts/api-server/dist/index.mjs",
  import.meta.url
);

console.log("[start] Loading bundle:", entrypoint.pathname);

try {
  await import(entrypoint.href);
  console.log("[start] Bundle loaded successfully.");
} catch (err) {
  console.error("[FATAL] Server failed to start:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
}
