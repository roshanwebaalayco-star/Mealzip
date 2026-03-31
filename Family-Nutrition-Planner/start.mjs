process.env.NODE_ENV = "production";
process.env.DEMO_MODE = process.env.DEMO_MODE || "true";
if (!process.env.PORT) process.env.PORT = "3000";

const entrypoint = new URL("./artifacts/api-server/dist/index.mjs", import.meta.url);
await import(entrypoint.href);
