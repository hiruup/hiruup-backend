# Air Quality Assistant (`air-quality`)

An intelligent air quality service that provides real-time AQI and actionable health advice (e.g., whether to wear a mask) for any city. Designed as an independent REST API service for client applications and the dedicated Polu MCP server.

## Features
- **City Geocoding**: Powered by OpenStreetMap Nominatim with strict 1 req/sec rate throttling.
- **Air Quality Feeds**: Real-time pollutant metrics and AQI from WAQI (aqicn.org).
- **Domain Advice Rules**: Deterministic rules based on US EPA standards:
  - `mask_recommended`: `AQI > 150`
  - `sensitive_groups_warning`: `AQI > 100`
- **Cross-Validation**: Verifies WAQI headline AQI against US EPA PM2.5 calculations (`validation: "ok"` or `"uncertain"`).
- **In-Memory Cache**: 15-minute TTL with automatic fallback to stale data if upstream WAQI is down.

---

## Getting Started

### 1. Prerequisites
- [Bun](https://bun.sh/) (v1.1 or later)

### 2. Obtain a Free WAQI Token
1. Go to the [WAQI Data Platform](https://aqicn.org/data-platform/token/).
2. Submit your name and email address.
3. Confirm the link in your email to receive your API token.

### 3. Setup Environment Variables
Copy `.env.example` to `.env`:
```sh
cp .env.example .env
```
Add your WAQI token:
```ini
WAQI_TOKEN=your_waqi_api_token_here
PORT=3001
```

### 4. Install Dependencies
```sh
bun install
```

### 5. Run the Server
```sh
bun run dev
```
The server will start on `http://localhost:3001`.
- API Reference / Scalar Docs: `http://localhost:3001/docs`
- OpenAPI Schema: `http://localhost:3001/openapi`
- Health check: `http://localhost:3001/health`

---

## API Usage

### `GET /v1/air-quality?city={city}`

**Example Request:**
```sh
curl "http://localhost:3001/v1/air-quality?city=Jakarta"
```

**Example Response (200 OK):**
```json
{
  "location": {
    "query": "Jakarta",
    "resolved": "Daerah Khusus Ibukota Jakarta, Indonesia",
    "lat": -6.1754,
    "lon": 106.8272
  },
  "measured_at": "2026-10-25T23:00:00+07:00",
  "aqi": {
    "value": 105,
    "category": "unhealthy for sensitive groups",
    "scale": "US-EPA"
  },
  "pollutants": {
    "pm25": 105,
    "pm10": 86,
    "no2": 24,
    "o3": 31
  },
  "advice": {
    "mask_recommended": false,
    "sensitive_groups_warning": true
  },
  "station": "Kemayoran, Indonesia",
  "source": "WAQI (aqicn.org)",
  "validation": "ok",
  "stale": false
}
```

---

## Running Tests
Run the complete automated test suite:
```sh
bun test
```

---

## MCP Server Integration

The Model Context Protocol (MCP) server has been separated into its own standalone project located in [`../mcp`](../mcp).

To configure Claude Desktop or other MCP clients to query this backend service, refer to the [MCP Server README](../mcp/README.md).
