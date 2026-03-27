import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);

// Global error handler — must be registered after all routes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const logger = (req as unknown as { log?: { error: (obj: Record<string, unknown>, msg: string) => void } }).log;
  if (logger) logger.error({ err }, `[ERROR] ${req.method} ${req.path}`);
  else console.error("[ERROR]", req.method, req.path, err);
  const status = (err as { status?: number; statusCode?: number }).status ?? (err as { status?: number; statusCode?: number }).statusCode ?? 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Something went wrong. Please try again."
      : (err instanceof Error ? err.message : "Internal server error");
  res.status(status).json({ error: message });
});

// In development, proxy all non-API requests to the Vite dev server
// so the Replit preview (which points to this port) shows the frontend.
if (process.env.NODE_ENV !== "production") {
  const VITE_PORT = process.env.VITE_DEV_PORT ?? "24170";
  app.use(
    createProxyMiddleware({
      target: `http://localhost:${VITE_PORT}`,
      changeOrigin: true,
      ws: true,
    }),
  );
}

export default app;
