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

const router: IRouter = Router();

// Strictly public routes — only /auth/register, /auth/login, and /healthz
// are intentionally unauthenticated.
// /auth/me uses authenticateToken internally.
// /auth/logout uses authenticateToken internally (requires a valid token).
router.use(authRouter);   // /auth/register, /auth/login (public); /auth/logout, /auth/me (auth-gated)
router.use(healthzRouter); // /healthz only

// All routes registered after this line require a valid JWT Bearer token.
router.use(authenticateToken);

router.use(familiesRouter);
router.use(recipesRouter);
router.use(mealPlansRouter);
router.use(mealFeedbackRouter);
router.use(nutritionRouter);
router.use(voiceRouter);
router.use(demoRouter);
router.use(geminiRouter);
router.use(groceryRouter);
router.use(healthRouter); // /health-logs, /nutrition-logs, /symptom-check, /fasting-calendar

export default router;
