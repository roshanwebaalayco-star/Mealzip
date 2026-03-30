import { describe, it, expect } from "vitest";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080";
const GEMINI_CONFIGURED = !!(process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY);

async function get(path: string, headers?: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}

let _demoData: Record<string, unknown> | null = null;
let _demoToken = "";

async function getDemoData(): Promise<{ token: string; data: Record<string, unknown> }> {
  if (_demoData && _demoToken) return { token: _demoToken, data: _demoData };
  const res = await fetch(`${BASE}/api/demo/instant`);
  expect(res.status).toBe(200);
  _demoData = await res.json() as Record<string, unknown>;
  _demoToken = (_demoData.token as string) ?? "";
  expect(_demoToken.length).toBeGreaterThan(0);
  return { token: _demoToken, data: _demoData };
}

describe("Level 3 — Regression Quick Checks", () => {
  describe("Quick Check 1 — healthz returns expected shape", () => {
    it("GET /api/healthz returns { status: ok, database: connected } with all fields", async () => {
      const { status, body } = await get("/api/healthz");
      expect(status).toBe(200);
      expect(body).toHaveProperty("status", "ok");
      expect(body).toHaveProperty("database", "connected");
      expect(typeof body.knowledgeChunks).toBe("number");
      expect(typeof body.recipes).toBe("number");
      expect(typeof body.embeddedRecipes).toBe("number");
      expect(typeof body.chunksBySource).toBe("object");
    });
  });

  describe("Quick Check 2 — Meal plan structure validation", () => {
    it("demo meal plan weekPlan has 7 days with breakfast/lunch/dinner", async () => {
      const { data } = await getDemoData();
      const mealPlan = data.mealPlan as Record<string, unknown>;
      expect(mealPlan).toBeDefined();

      const plan = mealPlan.plan as Record<string, unknown>;
      expect(plan).toBeDefined();
      expect(plan).toHaveProperty("days");

      const days = plan.days as Array<Record<string, unknown>>;
      expect(Array.isArray(days)).toBe(true);
      expect(days.length).toBe(7);

      for (const day of days) {
        expect(day).toHaveProperty("day");
        expect(typeof day.day).toBe("string");
        expect(day).toHaveProperty("meals");

        const meals = day.meals as Record<string, unknown>;
        expect(meals).toHaveProperty("breakfast");
        expect(meals).toHaveProperty("lunch");
        expect(meals).toHaveProperty("dinner");
      }
    });

    it("demo meal plan has harmonyScore between 0 and 100", async () => {
      const { data } = await getDemoData();
      const mealPlan = data.mealPlan as Record<string, unknown>;
      const plan = mealPlan.plan as Record<string, unknown>;
      const harmonyScore = Number(plan.harmonyScore ?? mealPlan.harmonyScore);
      expect(harmonyScore).toBeGreaterThanOrEqual(0);
      expect(harmonyScore).toBeLessThanOrEqual(100);
    });

    it.skipIf(!GEMINI_CONFIGURED)("AI-generated meal plan includes icmrCompliance and ragContextUsed metadata", async () => {
      const { token, data } = await getDemoData();
      const family = data.family as Record<string, unknown>;
      const familyId = family.id as number;
      expect(familyId).toBeGreaterThan(0);

      const res = await fetch(`${BASE}/api/meal-plans/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          familyId,
          weekStartDate: new Date().toISOString(),
        }),
      });
      expect(res.status).toBe(200);

      const body = await res.json() as Record<string, unknown>;
      expect(body).toHaveProperty("plan");

      const plan = body.plan as Record<string, unknown>;
      expect(plan).toHaveProperty("days");
      const days = plan.days as unknown[];
      expect(days.length).toBe(7);

      const score = Number(plan.harmonyScore ?? body.harmonyScore);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);

      expect(body).toHaveProperty("icmrCompliance");
      const compliance = body.icmrCompliance as Record<string, unknown>;
      expect(compliance).toHaveProperty("guidelinesRetrieved");
      expect(compliance).toHaveProperty("googleSearchGroundingEnabled");

      expect(body).toHaveProperty("ragContextUsed");
      const rag = body.ragContextUsed as Record<string, unknown>;
      expect(typeof rag.knowledgeChunks).toBe("number");
      expect(typeof rag.similarRecipes).toBe("number");
      expect(Array.isArray(rag.sources)).toBe(true);
    });
  });

  describe("Quick Check 3 — Chat RAG injection regression", () => {
    it.skipIf(!GEMINI_CONFIGURED)("diabetic breakfast query returns clinically appropriate foods (not cornflakes/white bread)", async () => {
      const { token } = await getDemoData();

      const convRes = await fetch(`${BASE}/api/gemini/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "RAG regression test" }),
      });
      expect(convRes.status).toBe(201);
      const conv = await convRes.json() as { id: number };
      expect(conv.id).toBeGreaterThan(0);

      const msgRes = await fetch(`${BASE}/api/gemini/conversations/${conv.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: "What should my diabetic father eat for breakfast?",
        }),
      });
      expect(msgRes.status).toBe(200);

      const responseText = await msgRes.text();
      const lines = responseText.split("\n").filter(l => l.startsWith("data: "));
      expect(lines.length).toBeGreaterThan(0);

      let fullContent = "";
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line.replace("data: ", "")) as { content?: string; done?: boolean };
          if (parsed.content) fullContent += parsed.content;
        } catch { /* skip malformed SSE lines */ }
      }
      expect(fullContent.length).toBeGreaterThan(0);

      const lowerContent = fullContent.toLowerCase();
      const clinicalFoods = ["methi", "dalia", "moong dal", "chilla", "ragi", "besan", "cheela", "oats", "idli", "upma", "poha"];
      const hasAppropriateFood = clinicalFoods.some(food => lowerContent.includes(food));
      expect(hasAppropriateFood).toBe(true);

      const badFoods = ["cornflakes", "white bread", "fruit juice"];
      const hasBadFood = badFoods.some(food => lowerContent.includes(food));
      expect(hasBadFood).toBe(false);
    });
  });

  describe("Authenticated API endpoint availability", () => {
    it("GET /api/recipes returns 200 with auth token", async () => {
      const { token } = await getDemoData();
      const { status, body } = await get("/api/recipes?limit=1", {
        Authorization: `Bearer ${token}`,
      });
      expect(status).toBe(200);
      expect(body.recipes).toBeInstanceOf(Array);
    });

    it("GET /api/families returns 200 with auth token", async () => {
      const { token } = await getDemoData();
      const { status } = await get("/api/families", {
        Authorization: `Bearer ${token}`,
      });
      expect(status).toBe(200);
    });
  });

  describe("Demo family structure validation", () => {
    it("demo family has 3 members with father/mother/child roles", async () => {
      const { data } = await getDemoData();
      const family = data.family as Record<string, unknown>;
      const members = family.members as Array<Record<string, unknown>>;
      expect(members.length).toBe(3);
      const roles = members.map(m => m.role);
      expect(roles).toContain("father");
      expect(roles).toContain("mother");
      expect(roles).toContain("child");
    });

    it("demo family father has diabetes in healthConditions", async () => {
      const { data } = await getDemoData();
      const family = data.family as Record<string, unknown>;
      const members = family.members as Array<Record<string, unknown>>;
      const father = members.find(m => m.role === "father");
      expect(father).toBeDefined();
      const conditions = (father!.healthConditions ?? father!.health_conditions) as string[];
      expect(Array.isArray(conditions)).toBe(true);
      expect(conditions).toContain("diabetes");
    });
  });
});
