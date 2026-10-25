import { describe, test, expect, mock, afterEach } from "bun:test";
import {
  WaqiClient,
  NoStationsError,
  WaqiUnavailableError,
  WaqiUpstreamError,
} from "../../src/integrations/waqi-api/client";

describe("WaqiClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("successfully parses WAQI feed response", async () => {
    const mockWaqiResponse = {
      status: "ok",
      data: {
        aqi: 153,
        idx: 8294,
        dominentpol: "pm25",
        city: {
          name: "Central Jakarta, Indonesia",
        },
        time: {
          s: "2026-10-25 12:00:00",
          iso: "2026-10-25T12:00:00+07:00",
        },
        iaqi: {
          pm25: { v: 153 },
          pm10: { v: 75 },
          no2: { v: 24 },
          o3: { v: 31 },
        },
      },
    };

    globalThis.fetch = mock((async () => {
      return new Response(JSON.stringify(mockWaqiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    const client = new WaqiClient("test-token");
    const result = await client.getFeedByCoordinates(-6.2, 106.8);

    expect(result.aqi).toBe(153);
    expect(result.dominantPol).toBe("pm25");
    expect(result.pollutants.pm25).toBe(153);
    expect(result.pollutants.pm10).toBe(75);
    expect(result.pollutants.no2).toBe(24);
    expect(result.pollutants.o3).toBe(31);
    expect(result.station).toBe("Central Jakarta, Indonesia");
    expect(result.source).toBe("WAQI (aqicn.org)");
    expect(result.measuredAt).toBe("2026-10-25T12:00:00+07:00");
  });

  test("throws NoStationsError when station is unknown", async () => {
    const mockUnknownStation = {
      status: "error",
      data: "Unknown station",
    };

    globalThis.fetch = mock((async () => {
      return new Response(JSON.stringify(mockUnknownStation), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    const client = new WaqiClient("test-token");
    expect(client.getFeedByCoordinates(0, 0)).rejects.toBeInstanceOf(NoStationsError);
  });

  test("throws WaqiUnavailableError when token is missing or invalid", async () => {
    const clientNoToken = new WaqiClient("");
    expect(clientNoToken.getFeedByCoordinates(-6.2, 106.8)).rejects.toBeInstanceOf(
      WaqiUnavailableError,
    );

    const mockInvalidKey = {
      status: "error",
      data: "Invalid key",
    };

    globalThis.fetch = mock((async () => {
      return new Response(JSON.stringify(mockInvalidKey), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    const clientWithInvalidKey = new WaqiClient("invalid-key");
    expect(clientWithInvalidKey.getFeedByCoordinates(-6.2, 106.8)).rejects.toBeInstanceOf(
      WaqiUnavailableError,
    );
  });
});
