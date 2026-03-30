import { describe, it, expect } from "vitest";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080";

async function get(path: string, headers?: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}

let demoToken = "";

async function getDemoToken(): Promise<string> {
  if (demoToken) return demoToken;
  const res = await fetch(`${BASE}/api/demo/instant`);
  const body = await res.json() as { token?: string };
  demoToken = body.token ?? "";
  return demoToken;
}

describe("Level 3 — Regression Quick Checks", () => {
  describe("Quick Check 1 — healthz shape", () => {
    it("GET /api/healthz returns expected JSON shape", async () => {
      const { status, body } = await get("/api/healthz");
      expect(status).toBe(200);
      expect(body).toHaveProperty("status", "ok");
      expect(body).toHaveProperty("database");
      expect(["connected", "disconnected"]).toContain(body.database);
    });
  });

  describe("Quick Check 2 — Meal plan response structure (via demo)", () => {
    it("demo instant endpoint returns a meal plan with expected fields", async () => {
      const res = await fetch(`${BASE}/api/demo/instant`);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;

      expect(body).toHaveProperty("mealPlan");

      const mealPlan = body.mealPlan as Record<string, unknown>;
      expect(mealPlan).toHaveProperty("plan");

      const plan = mealPlan.plan as Record<string, unknown>;
      expect(plan).toHaveProperty("days");

      const days = plan.days as unknown[];
      expect(Array.isArray(days)).toBe(true);
      expect(days.length).toBe(7);

      expect(plan).toHaveProperty("harmonyScore");
      const harmonyScore = Number(plan.harmonyScore ?? mealPlan.harmonyScore);
      expect(harmonyScore).toBeGreaterThanOrEqual(0);
      expect(harmonyScore).toBeLessThanOrEqual(100);
    });
  });

  describe("Quick Check 3 — Authenticated API endpoint availability", () => {
    it("GET /api/recipes returns 200 with auth token", async () => {
      const token = await getDemoToken();
      const { status, body } = await get("/api/recipes?limit=1", {
        Authorization: `Bearer ${token}`,
      });
      expect(status).toBe(200);
      expect(body.recipes).toBeInstanceOf(Array);
    });

    it("GET /api/families returns 200 with auth token", async () => {
      const token = await getDemoToken();
      const { status } = await get("/api/families", {
        Authorization: `Bearer ${token}`,
      });
      expect(status).toBe(200);
    });

    it("GET /api/nutrition/lookup returns 200 for known food with auth token", async () => {
      const token = await getDemoToken();
      const { status, body } = await get("/api/nutrition/lookup?q=dal+tadka&grams=200", {
        Authorization: `Bearer ${token}`,
      });
      expect(status).toBe(200);
      expect(body.calories).toBeGreaterThan(0);
    });
  });

  describe("Demo family structure validation", () => {
    it("demo family has expected member count and roles", async () => {
      const res = await fetch(`${BASE}/api/demo/instant`);
      const body = await res.json() as Record<string, unknown>;
      const family = body.family as Record<string, unknown>;
      expect(family).toHaveProperty("members");
      const members = family.members as Array<Record<string, unknown>>;
      expect(members.length).toBe(3);
      const roles = members.map(m => m.role);
      expect(roles).toContain("father");
      expect(roles).toContain("mother");
      expect(roles).toContain("child");
    });
  });
});
