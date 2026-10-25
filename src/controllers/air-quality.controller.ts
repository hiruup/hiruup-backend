import { Hono } from "hono";
import type { Env } from "hono-pino";
import { describeRoute, resolver } from "hono-openapi";
import {
  AirQualityQuerySchema,
  AirQualityResponseSchema,
  ErrorResponseSchema,
} from "@schemas/air-quality.schema";
import {
  airQualityService,
  AirQualityService,
} from "@services/air-quality.service";
import { CityNotFoundError, NominatimServiceError } from "@integrations/nominatim-api/client";
import {
  NoStationsError,
  WaqiUnavailableError,
  WaqiUpstreamError,
} from "@integrations/waqi-api/client";

export function createAirQualityController(
  service: AirQualityService = airQualityService,
): Hono<Env> {
  const controller = new Hono<Env>();

  controller.get(
    "/air-quality",
    describeRoute({
      summary: "Get current air quality and advice for a city",
      description:
        "Fetches coordinates from Nominatim, air quality feed from WAQI, cross-validates against EPA AQI standards, and returns actionable health advice.",
      parameters: [
        {
          name: "city",
          in: "query",
          required: true,
          description: "Name of the city, e.g. 'Jakarta' or 'Bandung'",
          schema: { type: "string", minLength: 1, maxLength: 100, example: "Jakarta" },
        },
      ],
      responses: {
        200: {
          description: "Successful response with air quality data and advice",
          content: {
            "application/json": { schema: resolver(AirQualityResponseSchema) },
          },
        },
        400: {
          description: "Invalid city parameter",
          content: {
            "application/json": { schema: resolver(ErrorResponseSchema) },
          },
        },
        404: {
          description: "City not found",
          content: {
            "application/json": { schema: resolver(ErrorResponseSchema) },
          },
        },
        422: {
          description: "No stations available near city",
          content: {
            "application/json": { schema: resolver(ErrorResponseSchema) },
          },
        },
        502: {
          description: "Upstream WAQI error",
          content: {
            "application/json": { schema: resolver(ErrorResponseSchema) },
          },
        },
        503: {
          description: "Service unavailable or rate limited",
          content: {
            "application/json": { schema: resolver(ErrorResponseSchema) },
          },
        },
      },
    }),
    async (c) => {
      const rawCity = c.req.query("city");
      const parsed = AirQualityQuerySchema.safeParse({ city: rawCity });

      if (!parsed.success) {
        return c.json(
          {
            error: {
              code: "INVALID_CITY",
              message:
                parsed.error.issues[0]?.message ??
                "City parameter is empty or exceeds 100 characters.",
              details: { issues: parsed.error.issues },
            },
          },
          400,
        );
      }

      const { city } = parsed.data;

      try {
        const result = await service.getAirQualityByCity(city);
        return c.json(result, 200);
      } catch (err) {
        if (err instanceof CityNotFoundError) {
          return c.json(
            {
              error: {
                code: err.code,
                message: err.message,
                details: {},
              },
            },
            404,
          );
        }

        if (err instanceof NoStationsError) {
          return c.json(
            {
              error: {
                code: err.code,
                message: err.message,
                details: {},
              },
            },
            422,
          );
        }

        if (err instanceof WaqiUpstreamError) {
          return c.json(
            {
              error: {
                code: err.code,
                message: err.message,
                details: {},
              },
            },
            502,
          );
        }

        if (err instanceof WaqiUnavailableError || err instanceof NominatimServiceError) {
          return c.json(
            {
              error: {
                code: err.code,
                message: err.message,
                details: {},
              },
            },
            503,
          );
        }

        return c.json(
          {
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: (err as Error).message || "An unexpected error occurred.",
              details: {},
            },
          },
          500,
        );
      }
    },
  );

  return controller;
}

export const airQualityController = createAirQualityController();
