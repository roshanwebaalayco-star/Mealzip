import { beforeAll, afterAll, vi } from "vitest";

beforeAll(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

process.env.NODE_ENV = "test";
process.env.GEMINI_API_KEY = "test-api-key-not-real";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
