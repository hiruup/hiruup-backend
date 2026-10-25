import { describe, test, expect } from "bun:test"
import { Hono } from "hono"
import { requestId } from "hono/request-id"
import { pinoLogger, type Env } from "hono-pino"
import pino from "pino"
import { logger } from "@core/logger"
import app from "@app"

describe("Logger & Pino Middleware", () => {
  test("standalone logger is defined and functional", () => {
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe("function")
    expect(typeof logger.error).toBe("function")
    expect(typeof logger.warn).toBe("function")
    expect(typeof logger.debug).toBe("function")
  })

  test("pinoLogger middleware attaches logger and requestId to context", async () => {
    let capturedReqId: string | undefined
    let hasLogger = false

    const testApp = new Hono<Env>()
      .use(requestId())
      .use(
        pinoLogger({
          pino: pino({ level: "silent" }),
        })
      )
      .get("/test-log", (c) => {
        hasLogger = typeof c.var.logger?.info === "function"
        capturedReqId = c.var.requestId
        c.var.logger.info({ customField: "test" }, "handler executed")
        return c.json({ ok: true })
      })

    const res = await testApp.request("/test-log", {
      headers: {
        "x-request-id": "custom-uuid-12345",
      },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get("x-request-id")).toBe("custom-uuid-12345")
    expect(capturedReqId).toBe("custom-uuid-12345")
    expect(hasLogger).toBe(true)
  })

  test("main app includes x-request-id on incoming requests", async () => {
    const res = await app.request("/docs")
    expect(res.status).toBe(200)
    expect(res.headers.has("x-request-id")).toBe(true)
  })
})
