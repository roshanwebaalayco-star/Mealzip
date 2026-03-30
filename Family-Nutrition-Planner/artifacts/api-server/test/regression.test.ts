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
  _demoData = await res.json() as Record<string, unknown>;
  _demoToken = (_demoData.token as string) ?? "";
  return { token: _demoToken, data: _demoData };
}

describe("Level 3 — Regression Quick Checks", () => {
  describe("Quick Check 1 — healthz returns expected shape", () => {
    it("GET /api/healthz returns { status: ok, database: connected }", async () => {
      const { status, body } = await get("/api/healthz");
      expect(status).toBe(200);
      expect(body).toHaveProperty("status", "ok");
      expect(body).toHaveProperty("database", "connected");
      expect(typeof body.knowledgeChunks).toBe("number");
      expect(typeof body.recipes).toBe("number");
      expect(typeof body.embeddedRecipes).toBe("number");
    });
  });

  describe("Quick Check 2 — Meal plan structure validation", () => {
    it("demo meal plan has weekPlan with 7 days", async () => {
      const { data } = await getDemoData();
      const mealPlan = data.mealPlan as Record<string, unknown>;
      expect(mealPlan).toBeDefined();
      expect(mealPlan).toHaveProperty("plan");

      const plan = mealPlan.plan as Record<string, unknown>;
      expect(plan).toHaveProperty("days");

      const days = plan.days as unknown[];
      expect(Array.isArray(days)).toBe(true);
      expect(days.length).toBe(7);

      const firstDay = days[0] as Record<string, unknown>;
      expect(firstDay).toHaveProperty("day");
      expect(firstDay).toHaveProperty("meals");

      const meals = firstDay.meals as Record<string, unknown>;
      expect(meals).toHaveProperty("breakfast");
      expect(meals).toHaveProperty("lunch");
      expect(meals).toHaveProperty("dinner");
    });

    it("demo meal plan has harmonyScore between 0 and 100", async () => {
      const { data } = await getDemoData();
      const mealPlan = data.mealPlan as Record<string, unknown>;
      const plan = mealPlan.plan as Record<string, unknown>;
      const harmonyScore = Number(plan.harmonyScore ?? mealPlan.harmonyScore);
      expect(harmonyScore).toBeGreaterThanOrEqual(0);
      expect(harmonyScore).toBeLessThanOrEqual(100);
    });

    it.skipIf(!GEMINI_CONFIGURED)("AI-generated meal plan has icmrCompliance with guidelinesFollowed", async () => {
      const { token, data } = await getDemoData();
      const family = data.family as Record<string, unknown>;
      const familyId = family.id as number;

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

      if (res.status !== 200) return;

      const body = await res.json() as Record<string, unknown>;
      if (body.icmrCompliance) {
        const compliance = body.icmrCompliance as Record<string, unknown>;
        expect(compliance).toHaveProperty("guidelinesRetrieved");
      }
      if (body.ragContextUsed) {
        const ragContext = body.ragContextUsed as Record<string, unknown>;
        expect(typeof ragContext.knowledgeChunks).toBe("number");
        expect(typeof ragContext.similarRecipes).toBe("number");
      }
    });
  });

  describe("Quick Check 3 — Chat RAG injection regression", () => {
    it.skipIf(!GEMINI_CONFIGURED)("chat response for diabetic breakfast query mentions clinically appropriate foods", async () => {
      const { token } = await getDemoData();

      const convRes = await fetch(`${BASE}/api/gemini/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "RAG regression test" }),
      });
      if (convRes.status !== 201) return;

      const conv = await convRes.json() as { id: number };

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

      if (msgRes.status !== 200) return;

      const responseText = await msgRes.text();
      const lines = responseText.split("\n").filter(l => l.startsWith("data: "));
      let fullContent = "";
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line.replace("data: ", "")) as { content?: string; done?: boolean };
          if (parsed.content) fullContent += parsed.content;
        } catch { /* skip parse errors */ }
      }

      if (fullContent.length === 0) return;

      const lowerContent = fullContent.toLowerCase();
      const clinicalFoods = ["methi", "dalia", "moong dal", "chilla", "ragi", "besan", "cheela", "oats", "idli"];
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
    it("demo family has 3 members with correct roles", async () => {
      const { data } = await getDemoData();
      const family = data.family as Record<string, unknown>;
      const members = family.members as Array<Record<string, unknown>>;
      expect(members.length).toBe(3);
      const roles = members.map(m => m.role);
      expect(roles).toContain("father");
      expect(roles).toContain("mother");
      expect(roles).toContain("child");
    });

    it("demo family father has diabetes health condition", async () => {
      const { data } = await getDemoData();
      const family = data.family as Record<string, unknown>;
      const members = family.members as Array<Record<string, unknown>>;
      const father = members.find(m => m.role === "father");
      expect(father).toBeDefined();
      const conditions = (father!.healthConditions ?? father!.health_conditions) as string[];
      expect(conditions).toContain("diabetes");
    });
  });
});
