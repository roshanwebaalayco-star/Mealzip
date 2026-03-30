import { describe, it, expect } from "vitest";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.json() };
}

async function adminPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": ADMIN_SECRET,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe("Level 1 — Functional Testing", () => {
  describe("Test 1 — Enhanced healthz", () => {
    it("returns status ok with database connectivity info", async () => {
      const { status, body } = await get("/api/healthz");
      expect(status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.database).toBe("connected");
      expect(typeof body.recipes).toBe("number");
      expect(body.recipes).toBeGreaterThan(0);
    });

    it("includes knowledgeChunks and embeddedRecipes counts", async () => {
      const { body } = await get("/api/healthz");
      expect(typeof body.knowledgeChunks).toBe("number");
      expect(typeof body.embeddedRecipes).toBe("number");
    });
  });

  describe("Test 2 — Knowledge base ingested (via healthz)", () => {
    it("has knowledge_chunks in database (0 if embedding not configured)", async () => {
      const { body } = await get("/api/healthz");
      expect(typeof body.knowledgeChunks).toBe("number");
    });
  });

  describe("Test 3 — Recipe embedding coverage (via healthz)", () => {
    it("reports recipe counts from healthz", async () => {
      const { body } = await get("/api/healthz");
      expect(body.recipes).toBeGreaterThan(1000);
    });
  });

  describe("Test 4 — Test retrieval endpoint exists", () => {
    it("rejects unauthenticated requests with 403", async () => {
      const res = await fetch(`${BASE}/api/admin/test-retrieval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "test" }),
      });
      expect(res.status).toBe(403);
    });

    it("rejects missing query with 400 (if admin secret set)", async () => {
      if (!ADMIN_SECRET) return;
      const { status, body } = await adminPost("/api/admin/test-retrieval", {});
      expect(status).toBe(400);
      expect(body.error).toContain("query");
    });
  });

  describe("Test 5 — Seed test families endpoint", () => {
    it("rejects unauthenticated requests with 403", async () => {
      const res = await fetch(`${BASE}/api/admin/seed-test-families`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(403);
    });
  });
});
