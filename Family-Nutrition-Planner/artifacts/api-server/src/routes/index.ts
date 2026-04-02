import { Router, type IRouter } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import authRouter from "./auth/index.js";
import healthzRouter from "./healthz/index.js";
import familiesRouter from "./families/index.js";
import recipesRouter from "./recipes/index.js";
import mealPlansRouter from "./meal-plans/index.js";
import mealFeedbackRouter from "./meal-feedback/index.js";
import nutritionRouter from "./nutrition/index.js";
import voiceRouter from "./voice/index.js";
import demoRouter from "./demo/index.js";
import geminiRouter from "./gemini/index.js";
import groceryRouter from "./grocery/index.js";
import healthRouter from "./health/index.js";
import marketRouter from "./market/index.js";
import leftoversRouter from "./leftovers/index.js";
import adminRouter from "./admin/index.js";
import chatRouter from "./chat/index.js";
import mealGenEngineRouter from "../engine/meal-generation-service.js";

const router: IRouter = Router();

// Strictly public routes — only /auth/register, /auth/login, /healthz,
// /demo/quick-login, and /admin/* (x-admin-secret gated) are unauthenticated.
router.use(authRouter);   // /auth/register, /auth/login (public); /auth/logout, /auth/me (auth-gated)
router.use(healthzRouter); // /healthz only
router.use(demoRouter);  // /demo/quick-login (public) + /demo/sharma-family + /demo/seed (public)
router.use(adminRouter); // /admin/* — protected by x-admin-secret header

// All routes registered after this line require a valid JWT Bearer token.
router.use(authenticateToken);

router.use(familiesRouter);
router.use(recipesRouter);
router.use(mealPlansRouter);
router.use(mealFeedbackRouter);
router.use(nutritionRouter);
router.use(voiceRouter);
router.use(geminiRouter);
router.use(groceryRouter);
router.use(healthRouter); // /health-logs, /nutrition-logs, /symptom-check, /fasting-calendar
router.use(marketRouter); // /market/prices, /market/trigger-surge, /market/prep-alerts
router.use(leftoversRouter); // /leftovers — leftover item tracking
router.use("/chat", chatRouter); // /chat — ParivarSehat AI SSE streaming chat
router.use("/meal-plans", mealGenEngineRouter); // ParivarSehat AI engine: /generate, /:id/status, /:id/conflicts, /:id/skip-meal

export default router;
