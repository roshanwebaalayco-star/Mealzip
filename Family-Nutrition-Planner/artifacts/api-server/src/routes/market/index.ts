import { Router, type IRouter } from "express";
import { getMandiPrices, triggerSurge, resetSurge } from "../../lib/mandi-data.js";
import { applyIngredientArbitrage } from "../../lib/arbitrage-engine.js";
import { scanPlanForPrepAlerts } from "../../lib/biochem-scanner.js";

const router: IRouter = Router();

router.get("/market/prices", (_req, res): void => {
  const prices = getMandiPrices();
  const arbitrage = applyIngredientArbitrage(prices.map(p => p.name));
  const surging = prices.filter(p => p.trend === "surging").map(p => p.name);
  res.json({
    prices,
    arbitrage: {
      hasArbitrage: arbitrage.hasArbitrage,
      swaps: arbitrage.swaps,
      totalSaved: arbitrage.totalSaved,
      alertMessage: arbitrage.alertMessage,
    },
    surging,
    source: "Bokaro Chas Mandi — Live Demo Feed",
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
    meals: Array<{ mealType: string; ingredients?: string[] }>;
  };
  if (!Array.isArray(meals)) {
    res.status(400).json({ error: "meals array required" });
    return;
  }
  const alerts = scanPlanForPrepAlerts(meals);
  res.json({ alerts });
});

export default router;
