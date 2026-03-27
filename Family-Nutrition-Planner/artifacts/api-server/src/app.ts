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
