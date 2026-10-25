import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? "development",
  waqiToken: process.env.WAQI_TOKEN ?? "",
  nominatimUserAgent: process.env.NOMINATIM_USER_AGENT ?? "PoluAirQualityApp/1.0",
  cacheTtlMs: Number(process.env.CACHE_TTL_MS ?? 15 * 60 * 1000), // 15 minutes default
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
};
