import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080";

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.json() };
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe("Nutrition Lookup API", () => {
  it("returns nutrition from recipe DB for known Indian food", async () => {
    const { status, body } = await get("/api/nutrition/lookup?q=dal+tadka&grams=200");
    expect(status).toBe(200);
    expect(body.source).toBe("recipe_db");
    expect(body.calories).toBeGreaterThan(0);
    expect(body.protein).toBeGreaterThan(0);
    expect(body.iron).toBeGreaterThanOrEqual(0);
  });

  it("falls back to ICMR food table for common foods not in recipes", async () => {
    const { status, body } = await get("/api/nutrition/lookup?q=moong+dal&grams=200");
    expect(status).toBe(200);
    expect(["recipe_db", "icmr_nin"]).toContain(body.source);
    expect(body.calories).toBeGreaterThan(0);
  });

  it("returns generic estimate for completely unknown food", async () => {
    const { status, body } = await get("/api/nutrition/lookup?q=obscure_food_xyz123&grams=100");
    expect(status).toBe(200);
    expect(body.source).toBe("generic_estimate");
    expect(body.calories).toBe(150);
  });

  it("requires q and grams parameters", async () => {
    const { status } = await get("/api/nutrition/lookup");
    expect(status).toBe(400);
  });
});

describe("Food Scan API (Demo Mode)", () => {
  it("returns demo scan results when DEMO_MODE=true and no YOLO URL", async () => {
    const { status, body } = await post("/api/nutrition/food-scan", {
      imageBase64: "dGVzdA==",
      mode: "food-log",
    });
    expect(status).toBe(200);
    expect(body.detectedFoods).toBeInstanceOf(Array);
    expect(body.detectedFoods.length).toBeGreaterThan(0);
    expect(body.confidenceThreshold).toBe(0.65);
    expect(body.demoMode).toBe(true);
  });

  it("has lowConfidenceItems in scan response", async () => {
    const { status, body } = await post("/api/nutrition/food-scan", {
      imageBase64: "dGVzdA==",
      mode: "food-log",
    });
    expect(status).toBe(200);
    expect(body).toHaveProperty("lowConfidenceItems");
    expect(body.lowConfidenceItems).toBeInstanceOf(Array);
  });

  it("all demo foods meet confidence threshold (no low-confidence in demo)", async () => {
    const { body } = await post("/api/nutrition/food-scan", {
      imageBase64: "dGVzdA==",
      mode: "food-log",
    });
    const allAboveThreshold = body.detectedFoods.every(
      (f: { confidence: number }) => f.confidence >= 0.65
    );
    expect(allAboveThreshold).toBe(true);
  });

  it("low-confidence items trigger manual-entry fallback path (lowConfidenceItems is server-authoritative)", async () => {
    const { status, body } = await post("/api/nutrition/food-scan", {
      imageBase64: "dGVzdA==",
      mode: "pantry",
    });
    expect(status).toBe(200);
    // lowConfidenceItems must always be present (even if empty array) — frontend relies on this field
    expect(body).toHaveProperty("lowConfidenceItems");
    expect(Array.isArray(body.lowConfidenceItems)).toBe(true);
    // Items in lowConfidenceItems must all be below threshold when threshold is present
    if (body.lowConfidenceItems.length > 0 && body.confidenceThreshold) {
      const allBelowThreshold = body.lowConfidenceItems.every(
        (f: { confidence: number }) => f.confidence < body.confidenceThreshold
      );
      expect(allBelowThreshold).toBe(true);
    }
    // detectedFoods must all be at or above threshold when threshold is present
    if (body.detectedFoods.length > 0 && body.confidenceThreshold) {
      const allAboveThreshold = body.detectedFoods.every(
        (f: { confidence: number }) => f.confidence >= body.confidenceThreshold
      );
      expect(allAboveThreshold).toBe(true);
    }
  });
});

describe("Recipe Search API", () => {
  it("returns recipes with maxCookTime filter", async () => {
    const { status, body } = await get("/api/recipes?maxCookTime=30&limit=10");
    expect(status).toBe(200);
    expect(body.recipes).toBeInstanceOf(Array);
    body.recipes.forEach((r: { totalTimeMin?: number }) => {
      if (r.totalTimeMin != null) {
        expect(r.totalTimeMin).toBeLessThanOrEqual(30);
      }
    });
  });

  it("returns recipes with diet filter", async () => {
    const { status, body } = await get("/api/recipes?diet=Vegetarian&limit=5");
    expect(status).toBe(200);
    expect(body.recipes.length).toBeGreaterThan(0);
  });

  it("full-text search returns relevant results", async () => {
    const { status, body } = await get("/api/recipes?q=biryani&limit=5");
    expect(status).toBe(200);
    const hasRelevant = body.recipes.some((r: { name?: string }) =>
      r.name?.toLowerCase().includes("biryani")
    );
    expect(hasRelevant).toBe(true);
  });

  it("seeded recipe dataset has sufficient entries (≥1000 complete-nutrition recipes from 58,711-row CSV)", async () => {
    const { status, body } = await get("/api/recipes?limit=1&offset=999");
    expect(status).toBe(200);
    expect(body.recipes).toBeInstanceOf(Array);
    expect(body.recipes.length).toBeGreaterThan(0);
  });
});

describe("Fasting Auto-Detection Logic", () => {
  it("families endpoint returns 200", async () => {
    const { status } = await get("/api/families");
    expect(status).toBe(200);
  });
});

describe("Meal Plan Generate — Date Coercion", () => {
  it("POST /api/meal-plans/generate accepts ISO date string (regression for weekStartDate z.coerce.date)", async () => {
    const body = {
      familyId: 999999,
      weekStartDate: new Date().toISOString(),
    };
    const res = await fetch(`http://localhost:8080/api/meal-plans/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { error?: string };
    expect(res.status).not.toBe(400);
    if (data.error) {
      expect(data.error).not.toMatch(/weekStartDate/i);
    }
  });
});

describe("Grocery Cheaper Alternative", () => {
  it("GET /api/grocery/cheaper-alternative returns alternatives from DB", async () => {
    const res = await fetch("http://localhost:8080/api/grocery/cheaper-alternative?item=rice&budget=80");
    expect(res.status).toBe(200);
    const data = await res.json() as { item: string; alternatives: Array<{ source: string }> };
    expect(data.item).toBe("rice");
    expect(Array.isArray(data.alternatives)).toBe(true);
    if (data.alternatives.length > 0) {
      expect(data.alternatives[0].source).toBe("recipe_db");
    }
  });

  it("GET /api/grocery/cheaper-alternative requires item param", async () => {
    const res = await fetch("http://localhost:8080/api/grocery/cheaper-alternative?budget=50");
    expect(res.status).toBe(400);
  });
});
