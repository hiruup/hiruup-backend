import { nominatimClient, NominatimClient } from "@integrations/nominatim-api/client";
import { waqiClient, WaqiClient } from "@integrations/waqi-api/client";
import { MemoryCache } from "@core/cache/memory-cache";
import {
  getAqiCategory,
  getAdvice,
  validateAqi,
  isDataStale,
} from "@core/aqi/calculator";
import type { AirQualityResponse } from "@schemas/air-quality.schema";

export class AirQualityService {
  private readonly cache: MemoryCache<AirQualityResponse>;

  constructor(
    private readonly geocoder: NominatimClient = nominatimClient,
    private readonly airData: WaqiClient = waqiClient,
    cache?: MemoryCache<AirQualityResponse>,
  ) {
    this.cache = cache ?? new MemoryCache<AirQualityResponse>();
  }

  async getAirQualityByCity(city: string): Promise<AirQualityResponse> {
    const normalizedCity = city.trim();
    const cacheKey = normalizedCity.toLowerCase();

    // 1. Check cache for fresh data
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // 2. Geocode city to coordinates
      const location = await this.geocoder.geocode(normalizedCity);

      // 3. Fetch WAQI data
      const feed = await this.airData.getFeedByCoordinates(location.lat, location.lon);

      // 4. Calculate domain metrics
      const category = getAqiCategory(feed.aqi);
      const advice = getAdvice(feed.aqi);
      const validation = validateAqi(feed.aqi, feed.dominantPol, feed.pollutants);
      const stale = isDataStale(feed.measuredAt);

      const response: AirQualityResponse = {
        location: {
          query: location.query,
          resolved: location.resolved,
          lat: location.lat,
          lon: location.lon,
        },
        measured_at: feed.measuredAt,
        aqi: {
          value: feed.aqi,
          category,
          scale: "US-EPA",
        },
        pollutants: feed.pollutants,
        advice,
        station: feed.station,
        source: "WAQI (aqicn.org)",
        validation,
        stale,
      };

      // 5. Store in cache
      this.cache.set(cacheKey, response);

      return response;
    } catch (err) {
      // 6. Fallback: if upstream error, check for expired cache entry
      const fallback = this.cache.getAny(cacheKey);
      if (fallback) {
        return {
          ...fallback.value,
          stale: true,
        };
      }
      throw err;
    }
  }

  getCache(): MemoryCache<AirQualityResponse> {
    return this.cache;
  }
}

export const airQualityService = new AirQualityService();
