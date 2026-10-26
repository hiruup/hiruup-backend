import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { pinoLogger } from "hono-pino";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { logger } from "@core/logger";
import { airQualityController } from "@controllers/air-quality.controller";
import {
  API_V1_URL,
  V1_URL,
  HEALTH_URL,
  DOCS_URL,
  OPENAPI_URL,
} from "@constants/route";

const app = new Hono();

app.use(requestId());
app.use(
  pinoLogger({
    pino: logger,
    http: {
      onResLevel: (c) => {
        if (c.res.status >= 500) return "error";
        if (c.res.status >= 400) return "warn";
        return "info";
      },
    },
  }),
);

// Health check endpoints
app.get(HEALTH_URL, (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  }),
);
app.get(`${API_V1_URL}${HEALTH_URL}`, (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  }),
);

// Base ping
app.get(API_V1_URL, (c) => c.json({ message: "Service is running" }));

// Mount Air Quality controllers
app.route(API_V1_URL, airQualityController);

// Documentation routes
app.get(
  DOCS_URL,
  Scalar({
    theme: "default",
    url: OPENAPI_URL,
  }),
);

app.get(
  OPENAPI_URL,
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "Air Quality API",
        version: "0.2.0",
        description: "Hiruup Air Quality Assistant API",
      },
      servers: [
        {
          url: "http://localhost:3001",
          description: "Local server",
        },
      ],
    },
  }),
);

export default app;
