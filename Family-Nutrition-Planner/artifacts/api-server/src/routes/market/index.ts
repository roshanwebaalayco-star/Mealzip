import { Router, type IRouter } from "express";
import { getMandiPrices, triggerSurge, resetSurge } from "../../lib/mandi-data.js";
import { applyIngredientArbitrage } from "../../lib/arbitrage-engine.js";
import { scanPlanForPrepAlerts } from "../../lib/biochem-scanner.js";

const router: IRouter = Router();

const REGION_MARKET_MAP: Record<string, string> = {
  north: "Delhi NCR Azadpur Mandi — Regional Prices",
  south: "Chennai Koyambedu Market — Regional Prices",
  east: "Kolkata Koley Market — Regional Prices",
  west: "Mumbai APMC Vashi Mandi — Regional Prices",
  central: "Bhopal Karond Mandi — Regional Prices",
};

router.get("/market/prices", async (req, res): Promise<void> => {
  const prices = getMandiPrices();
  const arbitrage = applyIngredientArbitrage(prices.map(p => p.name));
  const surging = prices.filter(p => p.trend === "surging").map(p => p.name);

  let source = "Ranchi Sukhdeonagar Market — Regional Prices";
  const familyId = req.query.familyId ? parseInt(req.query.familyId as string) : undefined;
  if (familyId) {
    try {
      const { db: dbImport } = await import("@workspace/db");
      const { familiesTable: ft } = await import("@workspace/db");
      const [fam] = await dbImport.select({ stateRegion: ft.stateRegion }).from(ft).where((await import("drizzle-orm")).eq(ft.id, familyId));
      if (fam?.stateRegion) {
        const region = fam.stateRegion.toLowerCase();
        source = REGION_MARKET_MAP[region] || `${fam.stateRegion} — Regional Prices`;
      }
    } catch { /* use default */ }
  }

  res.json({
    prices,
    arbitrage: {
      hasArbitrage: arbitrage.hasArbitrage,
      swaps: arbitrage.swaps,
      totalSaved: arbitrage.totalSaved,
      alertMessage: arbitrage.alertMessage,
    },
    surging,
    source,
    lastUpdated: new Date().toISOString(),
  });
});

router.post("/market/trigger-surge", (req, res): void => {
  const { ingredient, surgePercent, reset } = req.body as {
    ingredient?: string;
    surgePercent?: number;
    reset?: boolean;
  };
  if (reset) {
    resetSurge(ingredient);
    res.json({ ok: true, message: ingredient ? `Reset surge for ${ingredient}` : "All prices reset to baseline" });
    return;
  }
  const ing = ingredient ?? "Paneer";
  const pct = typeof surgePercent === "number" ? surgePercent : 42;
  triggerSurge(ing, pct);
  const prices = getMandiPrices();
  const arbitrage = applyIngredientArbitrage(prices.map(p => p.name));
  res.json({
    ok: true,
    message: `${ing} price surged +${pct}%`,
    alertMessage: arbitrage.alertMessage,
    swaps: arbitrage.swaps,
    prices,
  });
});

router.post("/market/prep-alerts", (req, res): void => {
  const { meals } = req.body as {
    meals: Array<{
      mealType: string;
      ingredients?: string[];
      base_ingredients?: Array<{ ingredient: string; qty_grams?: number }>;
    }>;
  };
  if (!Array.isArray(meals)) {
    res.status(400).json({ error: "meals array required" });
    return;
  }
  const alerts = scanPlanForPrepAlerts(meals);
  res.json({ alerts });
});

export default router;
