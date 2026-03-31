process.env.NODE_ENV = "production";
process.env.DEMO_MODE = process.env.DEMO_MODE || "true";

const entrypoint = new URL("./artifacts/api-server/dist/index.mjs", import.meta.url);
await import(entrypoint.href);
