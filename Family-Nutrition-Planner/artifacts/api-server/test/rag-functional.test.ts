import { describe, it, expect } from "vitest";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
const EMBEDDING_CONFIGURED = !!(process.env.GEMINI_API_KEY || (process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL));

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
  describe("Test 1 — Enhanced healthz with database check", () => {
    it("returns status ok with database connected", async () => {
      const { status, body } = await get("/api/healthz");
      expect(status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.database).toBe("connected");
    });

    it("reports recipe count > 1000", async () => {
      const { body } = await get("/api/healthz");
      expect(typeof body.recipes).toBe("number");
      expect(body.recipes).toBeGreaterThan(1000);
    });

    it("reports knowledgeChunks, embeddedRecipes, and chunksBySource", async () => {
      const { body } = await get("/api/healthz");
      expect(typeof body.knowledgeChunks).toBe("number");
      expect(typeof body.embeddedRecipes).toBe("number");
      expect(typeof body.chunksBySource).toBe("object");
    });
  });

  describe("Test 2 — Knowledge base source-grouped chunk counts", () => {
    it.skipIf(!EMBEDDING_CONFIGURED)("chunksBySource contains icmr_guidelines, meal_patterns, and icmr_rda sources", async () => {
      const { body } = await get("/api/healthz");
      expect(body.knowledgeChunks).toBeGreaterThan(0);

      const sources = body.chunksBySource as Record<string, number>;
      const sourceKeys = Object.keys(sources);

      const hasIcmrGuidelines = sourceKeys.some(k => k.includes("icmr_guidelines") || k.includes("icmr-guidelines"));
      const hasMealPatterns = sourceKeys.some(k => k.includes("meal_patterns") || k.includes("meal-patterns"));
      const hasIcmrRda = sourceKeys.some(k => k.includes("icmr_rda") || k.includes("icmr-rda") || k.includes("rda"));

      expect(hasIcmrGuidelines).toBe(true);
      expect(hasMealPatterns).toBe(true);
      expect(hasIcmrRda).toBe(true);

      for (const key of sourceKeys) {
        expect(sources[key]).toBeGreaterThan(0);
      }
    });

    it("chunksBySource is empty object when no chunks ingested", async () => {
      if (EMBEDDING_CONFIGURED) return;
      const { body } = await get("/api/healthz");
      expect(body.knowledgeChunks).toBe(0);
      expect(Object.keys(body.chunksBySource).length).toBe(0);
    });
  });

  describe("Test 3 — Recipe embedding coverage", () => {
    it("recipes table has > 1000 total recipes", async () => {
      const { body } = await get("/api/healthz");
      expect(body.recipes).toBeGreaterThan(1000);
    });

    it.skipIf(!EMBEDDING_CONFIGURED)("embedded recipes count > 0 and <= total recipes", async () => {
      const { body } = await get("/api/healthz");
      expect(body.embeddedRecipes).toBeGreaterThan(0);
      expect(body.embeddedRecipes).toBeLessThanOrEqual(body.recipes);
    });
  });

  describe("Test 4 — Vector search via test-retrieval endpoint", () => {
    it("rejects unauthenticated requests with 403", async () => {
      const res = await fetch(`${BASE}/api/admin/test-retrieval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "test" }),
      });
      expect(res.status).toBe(403);
    });

    it.skipIf(!ADMIN_SECRET)("rejects missing query with 400", async () => {
      const { status, body } = await adminPost("/api/admin/test-retrieval", {});
      expect(status).toBe(400);
      expect(body.error).toContain("query");
    });

    it.skipIf(!EMBEDDING_CONFIGURED || !ADMIN_SECRET)("returns recipes with similarity > 0.4 for diabetes breakfast query", async () => {
      const { status, body } = await adminPost("/api/admin/test-retrieval", {
        query: "diabetes low GI Indian breakfast",
        table: "recipes",
        limit: 10,
      });
      expect(status).toBe(200);
      expect(body.resultCount).toBeGreaterThan(0);

      const highRelevance = body.results.filter((r: { similarity: number }) => r.similarity > 0.4);
      expect(highRelevance.length).toBeGreaterThan(0);
    });

    it.skipIf(!EMBEDDING_CONFIGURED || !ADMIN_SECRET)("returns knowledge chunks with similarity > 0.3 for ICMR query", async () => {
      const { status, body } = await adminPost("/api/admin/test-retrieval", {
        query: "ICMR NIN 2024 recommended daily allowance protein",
        table: "knowledge_chunks",
        limit: 5,
      });
      expect(status).toBe(200);
      expect(body.resultCount).toBeGreaterThan(0);
      expect(body.results[0].similarity).toBeGreaterThan(0.3);
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

    it.skipIf(!ADMIN_SECRET)("seeds all 5 clinical test families with correct member counts", async () => {
      const { status, body } = await adminPost("/api/admin/seed-test-families", {});
      expect(status).toBe(200);
      expect(body.status).toBe("success");

      const families = body.families as Record<string, { familyId: number; memberCount: number }>;
      expect(families).toHaveProperty("diabetes_test");
      expect(families).toHaveProperty("weight_loss_test");
      expect(families).toHaveProperty("weight_gain_test");
      expect(families).toHaveProperty("multi_member_conflict");
      expect(families).toHaveProperty("budget_constraint");

      expect(families.diabetes_test.memberCount).toBe(1);
      expect(families.weight_loss_test.memberCount).toBe(1);
      expect(families.weight_gain_test.memberCount).toBe(1);
      expect(families.multi_member_conflict.memberCount).toBe(3);
      expect(families.budget_constraint.memberCount).toBe(4);
    });

    it.skipIf(!ADMIN_SECRET)("is idempotent — re-seeding returns same family IDs", async () => {
      const first = await adminPost("/api/admin/seed-test-families", {});
      const second = await adminPost("/api/admin/seed-test-families", {});
      expect(first.body.families.diabetes_test.familyId).toBe(second.body.families.diabetes_test.familyId);
    });
  });
});
