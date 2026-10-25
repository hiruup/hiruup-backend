import { apiCaller, ApiCallerError } from "@utils/api-caller";
import { env } from "@config/env";

export interface WaqiPollutants {
  pm25?: number;
  pm10?: number;
  no2?: number;
  o3?: number;
}

export interface WaqiFeedResult {
  aqi: number;
  dominantPol?: string;
  pollutants: WaqiPollutants;
  measuredAt: string;
  station: string;
  source: string;
}

export class NoStationsError extends Error {
  public readonly code = "NO_STATIONS";
  public readonly status = 422;

  constructor(message = "City found, but WAQI has no station within radius.") {
    super(message);
    this.name = "NoStationsError";
  }
}

export class WaqiUnavailableError extends Error {
  public readonly code = "UNAVAILABLE";
  public readonly status = 503;

  constructor(message = "WAQI service temporarily unavailable or invalid token.") {
    super(message);
    this.name = "WaqiUnavailableError";
  }
}

export class WaqiUpstreamError extends Error {
  public readonly code = "UPSTREAM_ERROR";
  public readonly status = 502;

  constructor(message = "WAQI upstream error.") {
    super(message);
    this.name = "WaqiUpstreamError";
  }
}

export class WaqiClient {
  private readonly baseUrl = "https://api.waqi.info";
  private readonly token: string;

  constructor(token?: string) {
    this.token = token ?? env.waqiToken;
  }

  async getFeedByCoordinates(lat: number, lon: number): Promise<WaqiFeedResult> {
    if (!this.token) {
      throw new WaqiUnavailableError("WAQI_TOKEN is not configured on the server.");
    }

    const endpoint = `${this.baseUrl}/feed/geo:${lat};${lon}/`;

    try {
      const res = await apiCaller.get<{
        status: string;
        data:
          | string
          | {
              aqi: number;
              dominentpol?: string;
              city?: { name?: string };
              time?: { s?: string; iso?: string };
              iaqi?: Record<string, { v?: number }>;
            };
      }>(endpoint, {
        params: { token: this.token },
      });

      const body = res.data;

      if (body.status !== "ok") {
        const errorText = typeof body.data === "string" ? body.data : "Unknown WAQI error";
        if (/unknown station/i.test(errorText)) {
          throw new NoStationsError(`No stations found near coordinates (${lat}, ${lon}).`);
        }
        if (/invalid key|quota|unauthorized/i.test(errorText)) {
          throw new WaqiUnavailableError(`WAQI token error: ${errorText}`);
        }
        throw new WaqiUpstreamError(`WAQI returned error: ${errorText}`);
      }

      if (!body.data || typeof body.data !== "object") {
        throw new WaqiUpstreamError("Invalid response data structure from WAQI.");
      }

      const data = body.data;
      const rawAqi = Number(data.aqi);
      if (isNaN(rawAqi)) {
        throw new NoStationsError("WAQI station returned no AQI measurement.");
      }

      const iaqi = data.iaqi || {};
      const pollutants: WaqiPollutants = {
        pm25: iaqi.pm25?.v !== undefined ? Number(iaqi.pm25.v) : undefined,
        pm10: iaqi.pm10?.v !== undefined ? Number(iaqi.pm10.v) : undefined,
        no2: iaqi.no2?.v !== undefined ? Number(iaqi.no2.v) : undefined,
        o3: iaqi.o3?.v !== undefined ? Number(iaqi.o3.v) : undefined,
      };

      const measuredAt =
        data.time?.iso ||
        (data.time?.s ? new Date(data.time.s).toISOString() : new Date().toISOString());

      const station = data.city?.name || "Nearest WAQI Station";

      return {
        aqi: rawAqi,
        dominantPol: data.dominentpol,
        pollutants,
        measuredAt,
        station,
        source: "WAQI (aqicn.org)",
      };
    } catch (err) {
      if (
        err instanceof NoStationsError ||
        err instanceof WaqiUnavailableError ||
        err instanceof WaqiUpstreamError
      ) {
        throw err;
      }
      if (err instanceof ApiCallerError) {
        if (err.status === 401 || err.status === 403) {
          throw new WaqiUnavailableError(`WAQI authorization failed with status ${err.status}`);
        }
        throw new WaqiUpstreamError(`WAQI HTTP error: ${err.status}`);
      }
      throw new WaqiUpstreamError(`Failed to fetch WAQI data: ${(err as Error).message}`);
    }
  }
}

export const waqiClient = new WaqiClient();
