import { describe, test, expect, mock, afterEach } from "bun:test";
import {
  NominatimClient,
  CityNotFoundError,
  NominatimServiceError,
} from "../../src/integrations/nominatim-api/client";

describe("NominatimClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("geocodes valid city successfully", async () => {
    const mockNominatimResponse = [
      {
        place_id: 12345,
        lat: "-6.2088",
        lon: "106.8456",
        display_name: "Jakarta, Indonesia",
      },
    ];

    globalThis.fetch = mock((async () => {
      return new Response(JSON.stringify(mockNominatimResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    const client = new NominatimClient({ minIntervalMs: 0 });
    const res = await client.geocode("Jakarta");

    expect(res.query).toBe("Jakarta");
    expect(res.resolved).toBe("Jakarta, Indonesia");
    expect(res.lat).toBe(-6.2088);
    expect(res.lon).toBe(106.8456);
  });

  test("throws CityNotFoundError when Nominatim returns empty array", async () => {
    globalThis.fetch = mock((async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    const client = new NominatimClient({ minIntervalMs: 0 });
    expect(client.geocode("NonExistentCityXYZ")).rejects.toBeInstanceOf(CityNotFoundError);
  });

  test("throws NominatimServiceError on 5xx or fetch failure", async () => {
    globalThis.fetch = mock((async () => {
      return new Response("Service Unavailable", { status: 503 });
    }) as unknown as typeof fetch);

    const client = new NominatimClient({ minIntervalMs: 0 });
    expect(client.geocode("Jakarta")).rejects.toBeInstanceOf(NominatimServiceError);
  });
});
