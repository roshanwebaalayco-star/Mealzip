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

    it("reports recipe count > 0", async () => {
      const { body } = await get("/api/healthz");
      expect(typeof body.recipes).toBe("number");
      expect(body.recipes).toBeGreaterThan(1000);
    });

    it("reports knowledgeChunks and embeddedRecipes as numbers", async () => {
      const { body } = await get("/api/healthz");
      expect(typeof body.knowledgeChunks).toBe("number");
      expect(typeof body.embeddedRecipes).toBe("number");
    });
  });

  describe("Test 2 — Knowledge base ingestion (source-grouped chunk counts)", () => {
    it.skipIf(!EMBEDDING_CONFIGURED)("knowledge_chunks table has rows grouped by source (icmr_guidelines, meal_patterns, icmr_rda)", async () => {
      const { body } = await get("/api/healthz");
      expect(body.knowledgeChunks).toBeGreaterThan(0);

      if (!ADMIN_SECRET) return;

      const icmrResult = await adminPost("/api/admin/test-retrieval", {
        query: "ICMR NIN 2024 dietary guidelines",
        table: "knowledge_chunks",
        limit: 5,
      });
      expect(icmrResult.status).toBe(200);
      expect(icmrResult.body.resultCount).toBeGreaterThan(0);
      const icmrSources = icmrResult.body.results.map((r: { source: string }) => r.source);
      expect(icmrSources.some((s: string) => s.includes("icmr"))).toBe(true);

      const mealPatternResult = await adminPost("/api/admin/test-retrieval", {
        query: "Indian meal pattern breakfast lunch dinner schedule",
        table: "knowledge_chunks",
        limit: 5,
      });
      expect(mealPatternResult.status).toBe(200);
      expect(mealPatternResult.body.resultCount).toBeGreaterThan(0);

      const rdaResult = await adminPost("/api/admin/test-retrieval", {
        query: "RDA recommended dietary allowance protein calories iron",
        table: "knowledge_chunks",
        limit: 5,
      });
      expect(rdaResult.status).toBe(200);
      expect(rdaResult.body.resultCount).toBeGreaterThan(0);
    });
  });

  describe("Test 3 — Recipe embedding coverage", () => {
    it("recipes table has total recipes loaded", async () => {
      const { body } = await get("/api/healthz");
      expect(body.recipes).toBeGreaterThan(1000);
    });

    it.skipIf(!EMBEDDING_CONFIGURED)("embedded recipes count > 0 when embedding is configured", async () => {
      const { body } = await get("/api/healthz");
      expect(body.embeddedRecipes).toBeGreaterThan(0);
      expect(body.embeddedRecipes).toBeLessThanOrEqual(body.recipes);
    });
  });

  describe("Test 4 — Vector search relevance via test-retrieval endpoint", () => {
    it("rejects unauthenticated requests with 403", async () => {
      const res = await fetch(`${BASE}/api/admin/test-retrieval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "test" }),
      });
      expect(res.status).toBe(403);
    });

    it("rejects missing query with 400 when admin secret is set", async () => {
      if (!ADMIN_SECRET) return;
      const { status, body } = await adminPost("/api/admin/test-retrieval", {});
      expect(status).toBe(400);
      expect(body.error).toContain("query");
    });

    it.skipIf(!EMBEDDING_CONFIGURED || !ADMIN_SECRET)("returns relevant recipes with similarity > 0.4 for diabetes breakfast query", async () => {
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

    it.skipIf(!EMBEDDING_CONFIGURED || !ADMIN_SECRET)("returns relevant knowledge chunks for ICMR query", async () => {
      const { status, body } = await adminPost("/api/admin/test-retrieval", {
        query: "ICMR NIN 2024 recommended daily allowance protein",
        table: "knowledge_chunks",
        limit: 5,
      });
      expect(status).toBe(200);
      expect(body.resultCount).toBeGreaterThan(0);

      const topResult = body.results[0];
      expect(topResult.similarity).toBeGreaterThan(0.3);
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

    it.skipIf(!ADMIN_SECRET)("seeds all 5 clinical test families and returns their IDs", async () => {
      const { status, body } = await adminPost("/api/admin/seed-test-families", {});
      expect(status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.families).toHaveProperty("diabetes_test");
      expect(body.families).toHaveProperty("weight_loss_test");
      expect(body.families).toHaveProperty("weight_gain_test");
      expect(body.families).toHaveProperty("multi_member_conflict");
      expect(body.families).toHaveProperty("budget_constraint");

      expect(body.families.diabetes_test.memberCount).toBe(1);
      expect(body.families.weight_loss_test.memberCount).toBe(1);
      expect(body.families.weight_gain_test.memberCount).toBe(1);
      expect(body.families.multi_member_conflict.memberCount).toBe(3);
      expect(body.families.budget_constraint.memberCount).toBe(4);
    });

    it.skipIf(!ADMIN_SECRET)("is idempotent — re-seeding returns same family IDs", async () => {
      const first = await adminPost("/api/admin/seed-test-families", {});
      const second = await adminPost("/api/admin/seed-test-families", {});
      expect(first.body.families.diabetes_test.familyId).toBe(second.body.families.diabetes_test.familyId);
    });
  });
});
