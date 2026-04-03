import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    root: ".",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      include: [
        "src/engine/**/*.ts",
      ],
      exclude: [
        "src/engine/meal-generation-service.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "../../db": path.resolve(__dirname, "db/index.ts"),
      "../../db/schema": path.resolve(__dirname, "db/schema.ts"),
    },
  },
});
