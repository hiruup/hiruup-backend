import {
  AqiBreakpoint,
  EPA_PM25_BREAKPOINTS_2024,
  EPA_PM25_BREAKPOINTS_PRE_2024,
} from "./breakpoints";

export type AqiCategory =
  | "good"
  | "moderate"
  | "unhealthy for sensitive groups"
  | "unhealthy"
  | "very unhealthy"
  | "hazardous";

export interface Advice {
  mask_recommended: boolean;
  sensitive_groups_warning: boolean;
}

export function getAqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "unhealthy for sensitive groups";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very unhealthy";
  return "hazardous";
}

export function getAdvice(aqi: number): Advice {
  return {
    mask_recommended: aqi > 150,
    sensitive_groups_warning: aqi > 100,
  };
}

/**
 * Calculates PM2.5 AQI based on EPA piecewise linear formula:
 * I = ((I_high - I_low) / (C_high - C_low)) * (C - C_low) + I_low
 */
export function calculatePm25Aqi(
  concentration: number,
  breakpoints: AqiBreakpoint[] = EPA_PM25_BREAKPOINTS_2024,
): number {
  if (concentration < 0) return 0;

  // EPA guidelines truncate concentration to 1 decimal place
  const c = Math.floor(concentration * 10) / 10;

  for (const bp of breakpoints) {
    if (c >= bp.cLow && c <= bp.cHigh) {
      const aqi =
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (c - bp.cLow) + bp.iLow;
      return Math.round(aqi);
    }
  }

  // If concentration exceeds the highest breakpoint, cap or extrapolate
  const lastBp = breakpoints[breakpoints.length - 1];
  if (c > lastBp.cHigh) {
    return Math.round(
      ((lastBp.iHigh - lastBp.iLow) / (lastBp.cHigh - lastBp.cLow)) *
        (c - lastBp.cLow) +
        lastBp.iLow,
    );
  }

  return 0;
}

export interface ValidationOptions {
  threshold?: number;
}

/**
 * Cross-validates WAQI headline AQI against calculation in code.
 * If difference exceeds threshold, returns "uncertain", otherwise "ok".
 */
export function validateAqi(
  headlineAqi: number,
  dominantPollutant: string | undefined,
  pollutants: { pm25?: number; pm10?: number; no2?: number; o3?: number },
  options: ValidationOptions = {},
): "ok" | "uncertain" {
  const threshold = options.threshold ?? 15;

  if (headlineAqi < 0 || isNaN(headlineAqi)) {
    return "uncertain";
  }

  // If dominant pollutant is PM2.5 and PM2.5 raw concentration is provided
  if (
    (!dominantPollutant || dominantPollutant.toLowerCase() === "pm25") &&
    pollutants.pm25 !== undefined
  ) {
    const calculated2024 = calculatePm25Aqi(pollutants.pm25, EPA_PM25_BREAKPOINTS_2024);
    const calculatedPre2024 = calculatePm25Aqi(pollutants.pm25, EPA_PM25_BREAKPOINTS_PRE_2024);

    const diff2024 = Math.abs(headlineAqi - calculated2024);
    const diffPre2024 = Math.abs(headlineAqi - calculatedPre2024);

    // If it matches either 2024 or pre-2024 standard within threshold, it's valid
    if (diff2024 <= threshold || diffPre2024 <= threshold) {
      return "ok";
    }

    return "uncertain";
  }

  // If dominant pollutant is another pollutant, we can't refute WAQI unless headline AQI is absurd
  return "ok";
}

/**
 * Checks if measurement timestamp is older than maxAgeHours (default 3 hours).
 */
export function isDataStale(measuredAt: string | Date, maxAgeHours = 3): boolean {
  try {
    const measuredTime =
      typeof measuredAt === "string" ? new Date(measuredAt).getTime() : measuredAt.getTime();
    if (isNaN(measuredTime)) return false;

    const now = Date.now();
    const diffMs = now - measuredTime;
    return diffMs > maxAgeHours * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
