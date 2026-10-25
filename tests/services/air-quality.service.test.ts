import { describe, test, expect, mock } from "bun:test";
import { AirQualityService } from "../../src/services/air-quality.service";
import { NominatimClient } from "../../src/integrations/nominatim-api/client";
import { WaqiClient, WaqiUpstreamError } from "../../src/integrations/waqi-api/client";
import { MemoryCache } from "../../src/core/cache/memory-cache";

describe("AirQualityService", () => {
  test("successfully orchestrates geocoding, WAQI feed, advice, and caching", async () => {
    const mockGeocoder = {
      geocode: mock(async (city: string) => ({
        query: city,
        resolved: "Jakarta, Special Capital Region of Jakarta, Indonesia",
        lat: -6.2,
        lon: 106.8,
      })),
    } as unknown as NominatimClient;

    const mockWaqi = {
      getFeedByCoordinates: mock(async () => ({
        aqi: 160,
        dominantPol: "pm25",
        pollutants: { pm25: 72.5, pm10: 80 },
        measuredAt: new Date().toISOString(),
        station: "Central Jakarta",
        source: "WAQI (aqicn.org)",
      })),
    } as unknown as WaqiClient;

    const cache = new MemoryCache();
    const service = new AirQualityService(mockGeocoder, mockWaqi, cache);

    const res1 = await service.getAirQualityByCity("Jakarta");

    expect(res1.location.query).toBe("Jakarta");
    expect(res1.location.resolved).toContain("Jakarta");
    expect(res1.aqi.value).toBe(160);
    expect(res1.aqi.category).toBe("unhealthy");
    expect(res1.advice.mask_recommended).toBe(true);
    expect(res1.advice.sensitive_groups_warning).toBe(true);
    expect(res1.stale).toBe(false);
    expect(res1.source).toBe("WAQI (aqicn.org)");

    // Second call should hit cache without calling geocoder or WAQI again
    const res2 = await service.getAirQualityByCity("jakarta");
    expect(res2).toEqual(res1);
    expect(mockGeocoder.geocode).toHaveBeenCalledTimes(1);
    expect(mockWaqi.getFeedByCoordinates).toHaveBeenCalledTimes(1);
  });

  test("serves expired cached data with stale: true if upstream call fails", async () => {
    const mockGeocoder = {
      geocode: mock(async (city: string) => ({
        query: city,
        resolved: "Surabaya, East Java, Indonesia",
        lat: -7.25,
        lon: 112.75,
      })),
    } as unknown as NominatimClient;

    let shouldFail = false;
    const mockWaqi = {
      getFeedByCoordinates: mock(async () => {
        if (shouldFail) {
          throw new WaqiUpstreamError("Upstream timeout");
        }
        return {
          aqi: 90,
          dominantPol: "pm25",
          pollutants: { pm25: 30 },
          measuredAt: new Date().toISOString(),
          station: "Surabaya Station",
          source: "WAQI (aqicn.org)",
        };
      }),
    } as unknown as WaqiClient;

    const cache = new MemoryCache(20); // 20ms TTL
    const service = new AirQualityService(mockGeocoder, mockWaqi, cache);

    // Initial successful query
    const res1 = await service.getAirQualityByCity("Surabaya");
    expect(res1.stale).toBe(false);

    // Wait for cache to expire
    await new Promise((r) => setTimeout(r, 30));

    // Now make WAQI fail
    shouldFail = true;

    // Service should fall back to expired cache entry and set stale: true
    const res2 = await service.getAirQualityByCity("Surabaya");
    expect(res2.stale).toBe(true);
    expect(res2.aqi.value).toBe(90);
  });
});
