import { apiCaller, ApiCallerError } from "@utils/api-caller";
import { env } from "@config/env";

export interface GeocodedLocation {
  query: string;
  resolved: string;
  lat: number;
  lon: number;
}

export class CityNotFoundError extends Error {
  public readonly code = "CITY_NOT_FOUND";
  public readonly status = 404;

  constructor(public readonly city: string) {
    super(`City '${city}' not found.`);
    this.name = "CityNotFoundError";
  }
}

export class NominatimServiceError extends Error {
  public readonly code = "UNAVAILABLE";
  public readonly status = 503;

  constructor(message: string, public readonly originalStatus?: number) {
    super(message);
    this.name = "NominatimServiceError";
  }
}

export class NominatimClient {
  private lastRequestTime = 0;
  private readonly minIntervalMs: number;
  private readonly userAgent: string;

  constructor(options: { minIntervalMs?: number; userAgent?: string } = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 1000; // 1 req/sec limit
    this.userAgent = options.userAgent ?? env.nominatimUserAgent;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - timeSinceLast;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  async geocode(city: string): Promise<GeocodedLocation> {
    const trimmed = city.trim();
    if (!trimmed) {
      throw new CityNotFoundError(city);
    }

    await this.throttle();

    try {
      const res = await apiCaller.get<
        Array<{
          display_name: string;
          lat: string;
          lon: string;
        }>
      >("https://nominatim.openstreetmap.org/search", {
        params: {
          q: trimmed,
          format: "json",
          limit: 1,
        },
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
      });

      const results = res.data;
      if (!Array.isArray(results) || results.length === 0) {
        throw new CityNotFoundError(trimmed);
      }

      const top = results[0];
      const lat = parseFloat(top.lat);
      const lon = parseFloat(top.lon);

      if (isNaN(lat) || isNaN(lon)) {
        throw new CityNotFoundError(trimmed);
      }

      return {
        query: trimmed,
        resolved: top.display_name,
        lat,
        lon,
      };
    } catch (err) {
      if (err instanceof CityNotFoundError) {
        throw err;
      }
      if (err instanceof ApiCallerError) {
        throw new NominatimServiceError(
          `Nominatim geocoding service returned status ${err.status}`,
          err.status,
        );
      }
      throw new NominatimServiceError(
        `Failed to reach geocoding service: ${(err as Error).message}`,
      );
    }
  }
}

export const nominatimClient = new NominatimClient();
