import { describe, test, expect, mock, afterEach } from "bun:test";
import app from "@app";
import { AirQualityResponseSchema } from "@schemas/air-quality.schema";

describe("Air Quality API Endpoints", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("GET /health", () => {
    test("returns 200 with status ok", async () => {
      const res = await app.request("/health", { method: "GET" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeDefined();
    });
  });

  describe("GET /v1/air-quality", () => {
    test("returns 400 INVALID_CITY when city query is empty", async () => {
      const res = await app.request("/v1/air-quality?city=", { method: "GET" });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error?.code).toBe("INVALID_CITY");
    });

    test("returns 400 INVALID_CITY when city query exceeds 100 characters", async () => {
      const longCity = "A".repeat(101);
      const res = await app.request(`/v1/air-quality?city=${longCity}`, { method: "GET" });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error?.code).toBe("INVALID_CITY");
    });

    test("returns 200 with valid PRD contract on successful query", async () => {
      globalThis.fetch = mock((async (input: string | URL | Request) => {
        const url = input.toString();
        if (url.includes("nominatim.openstreetmap.org")) {
          return new Response(
            JSON.stringify([
              {
                display_name: "Jakarta, Indonesia",
                lat: "-6.2",
                lon: "106.82",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("api.waqi.info")) {
          return new Response(
            JSON.stringify({
              status: "ok",
              data: {
                aqi: 153,
                dominentpol: "pm25",
                city: { name: "Central Jakarta" },
                time: { iso: new Date().toISOString() },
                iaqi: {
                  pm25: { v: 58.4 },
                  pm10: { v: 90.1 },
                  no2: { v: 24.0 },
                  o3: { v: 31.2 },
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("Not found", { status: 404 });
      }) as unknown as typeof fetch);

      const res = await app.request("/v1/air-quality?city=Jakarta", { method: "GET" });
      expect(res.status).toBe(200);

      const body = await res.json();
      const validation = AirQualityResponseSchema.safeParse(body);
      expect(validation.success).toBe(true);

      expect(body.location.query).toBe("Jakarta");
      expect(body.location.resolved).toBe("Jakarta, Indonesia");
      expect(body.aqi.value).toBe(153);
      expect(body.aqi.category).toBe("unhealthy");
      expect(body.advice.mask_recommended).toBe(true);
      expect(body.advice.sensitive_groups_warning).toBe(true);
      expect(body.source).toBe("WAQI (aqicn.org)");
      expect(body.stale).toBe(false);
    });

    test("returns 404 CITY_NOT_FOUND when geocoder finds no match", async () => {
      globalThis.fetch = mock((async () => {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as unknown as typeof fetch);

      const res = await app.request("/v1/air-quality?city=UnknownCity12345", { method: "GET" });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error?.code).toBe("CITY_NOT_FOUND");
    });
  });
});
