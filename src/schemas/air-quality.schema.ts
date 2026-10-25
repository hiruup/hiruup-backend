import { z } from "zod";

export const AirQualityQuerySchema = z.object({
  city: z
    .string()
    .trim()
    .min(1, { message: "City name cannot be empty" })
    .max(100, { message: "City name cannot exceed 100 characters" })
    .describe("Name of the city, e.g. 'Jakarta'"),
});

export const LocationSchema = z.object({
  query: z.string().describe("Original query string"),
  resolved: z.string().describe("Resolved full place name from geocoder"),
  lat: z.number().describe("Latitude"),
  lon: z.number().describe("Longitude"),
});

export const AqiSchema = z.object({
  value: z.number().describe("AQI numerical value"),
  category: z.string().describe("AQI category (good, moderate, unhealthy, etc.)"),
  scale: z.literal("US-EPA").describe("Air quality index scale"),
});

export const PollutantsSchema = z.object({
  pm25: z.number().optional().describe("PM2.5 concentration in ug/m3 or IAQI"),
  pm10: z.number().optional().describe("PM10 concentration in ug/m3 or IAQI"),
  no2: z.number().optional().describe("NO2 concentration in ppb or IAQI"),
  o3: z.number().optional().describe("O3 concentration in ppb or IAQI"),
});

export const AdviceSchema = z.object({
  mask_recommended: z.boolean().describe("Whether wearing a mask is recommended"),
  sensitive_groups_warning: z
    .boolean()
    .describe("Whether sensitive groups should take precautions"),
});

export const AirQualityResponseSchema = z.object({
  location: LocationSchema,
  measured_at: z.string().describe("ISO timestamp of the measurement"),
  aqi: AqiSchema,
  pollutants: PollutantsSchema,
  advice: AdviceSchema,
  station: z.string().describe("Reporting monitoring station name"),
  source: z.literal("WAQI (aqicn.org)").describe("Data source attribution"),
  validation: z.enum(["ok", "uncertain"]).describe("Result of cross-validation"),
  stale: z.boolean().describe("True if data is older than 3 hours or served from fallback cache"),
});

export const ErrorDetailSchema = z.object({
  code: z.string().describe("Error code (INVALID_CITY, CITY_NOT_FOUND, etc.)"),
  message: z.string().describe("Descriptive error message"),
  details: z.record(z.string(), z.unknown()).default({}).describe("Additional error details"),
});

export const ErrorResponseSchema = z.object({
  error: ErrorDetailSchema,
});

export type AirQualityResponse = z.infer<typeof AirQualityResponseSchema>;
export type AirQualityQuery = z.infer<typeof AirQualityQuerySchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
