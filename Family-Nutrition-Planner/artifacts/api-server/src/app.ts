import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

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

app.use("/api", (_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const reqLogger = (req as unknown as { log?: { error: (obj: Record<string, unknown>, msg: string) => void } }).log;
  if (reqLogger) reqLogger.error({ err }, `[ERROR] ${req.method} ${req.path}`);
  else console.error("[ERROR]", req.method, req.path, err);

  // Detect database connectivity errors and surface them as 503 Service Unavailable
  const isDatabaseError = isDbConnectivityError(err);
  const explicitStatus = (err as { status?: number; statusCode?: number }).status ?? (err as { status?: number; statusCode?: number }).statusCode;
  const status = isDatabaseError ? 503 : (explicitStatus ?? 500);

  const message =
    process.env.NODE_ENV === "production"
      ? (isDatabaseError ? "Database temporarily unavailable. Please try again shortly." : "Something went wrong. Please try again.")
      : (err instanceof Error ? err.message : "Internal server error");
  res.status(status).json({ error: message });
});

function isDbConnectivityError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  // pg / node error codes for connection failures
  const CONNECTION_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "57P03"]);
  if (e.code && CONNECTION_CODES.has(e.code)) return true;
  // Pool-level messages from node-postgres
  const msg = e.message ?? "";
  if (
    msg.includes("Connection terminated") ||
    msg.includes("connect ECONNREFUSED") ||
    msg.includes("timeout expired") ||
    msg.includes("no pg_hba.conf entry") ||
    msg.includes("database") && msg.includes("does not exist")
  ) return true;
  return false;
}

if (process.env.NODE_ENV === "production") {
  const candidates = [
    path.resolve(__dirname, "public"),
    path.resolve(process.cwd(), "client"),
    path.resolve(process.cwd(), "Family-Nutrition-Planner/artifacts/api-server/dist/public"),
  ];
  const clientDist = candidates.find((p) => existsSync(p));
  if (clientDist) {
    app.use(express.static(clientDist, { maxAge: "1d" }));
    app.use((_req: express.Request, res: express.Response) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
    logger.info({ clientDist }, "Serving static frontend from built assets");
  } else {
    logger.warn({ candidates }, "No built frontend found — API-only mode");
    app.use((_req: express.Request, res: express.Response) => {
      res.status(200).json({ status: "ok", message: "ParivarSehat AI API is running" });
    });
  }
} else {
  (async () => {
    const { createProxyMiddleware } = await import("http-proxy-middleware");
    const VITE_PORT = process.env.VITE_DEV_PORT ?? "24170";
    app.use(
      createProxyMiddleware({
        target: `http://localhost:${VITE_PORT}`,
        changeOrigin: true,
        ws: true,
      }),
    );
  })();
}

export default app;
