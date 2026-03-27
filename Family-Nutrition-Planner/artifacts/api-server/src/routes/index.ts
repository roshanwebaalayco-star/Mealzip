import { Router, type IRouter } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import authRouter from "./auth/index.js";
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

// Public routes — no authentication required
router.use(authRouter);   // /auth/register, /auth/login, /auth/logout, /auth/me
router.use(healthRouter); // /healthz

// All routes registered after this line require a valid JWT
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

export default router;
