import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  apiCaller,
  createApiClient,
  ApiCallerError,
  ApiClient,
} from "@utils/api-caller";

describe("ApiClient / apiCaller", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("apiCaller is an instance of ApiClient", () => {
    expect(apiCaller).toBeInstanceOf(ApiClient);
  });

  test("successfully executes GET request with query params", async () => {
    const mockResponseData = { id: 1, name: "Air Quality Station" };
    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    globalThis.fetch = mock((async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = input.toString();
      capturedOptions = init;
      return new Response(JSON.stringify(mockResponseData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "https://api.example.com" });
    const response = await client.get<typeof mockResponseData>("/data", {
      params: { lat: 40.71, lon: -74.0, unused: undefined, empty: null },
    });

    expect(capturedUrl).toBe("https://api.example.com/data?lat=40.71&lon=-74");
    expect(capturedOptions?.method).toBe("GET");
    expect(response.status).toBe(200);
    expect(response.data).toEqual(mockResponseData);
  });

  test("merges default headers and custom headers", async () => {
    let capturedHeaders: Headers | undefined;

    globalThis.fetch = mock((async (_input: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    const client = createApiClient({
      headers: {
        Authorization: "Bearer default-token",
        "X-App": "HiruupBackend",
      },
    });

    await client.get("https://api.example.com/test", {
      headers: {
        "X-Custom": "CustomValue",
      },
    });

    expect(capturedHeaders?.get("authorization")).toBe("Bearer default-token");
    expect(capturedHeaders?.get("x-app")).toBe("HiruupBackend");
    expect(capturedHeaders?.get("x-custom")).toBe("CustomValue");
  });

  test("automatically sets application/json content-type and serializes json body for POST", async () => {
    let capturedBody: string | undefined;
    let capturedHeaders: Headers | undefined;

    globalThis.fetch = mock((async (_input: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ created: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    const payload = { title: "Test Station", city: "NYC" };
    const res = await apiCaller.post<{ created: boolean }>(
      "https://api.example.com/stations",
      payload,
    );

    expect(capturedHeaders?.get("content-type")).toBe("application/json");
    expect(JSON.parse(capturedBody!)).toEqual(payload);
    expect(res.status).toBe(201);
    expect(res.data.created).toBe(true);
  });

  test("supports PUT, PATCH, and DELETE methods", async () => {
    const methodsCalled: string[] = [];

    globalThis.fetch = mock((async (_input: string | URL | Request, init?: RequestInit) => {
      methodsCalled.push(init?.method || "GET");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    await apiCaller.put("https://api.example.com/item/1", { name: "Updated" });
    await apiCaller.patch("https://api.example.com/item/1", { status: "active" });
    await apiCaller.delete("https://api.example.com/item/1");

    expect(methodsCalled).toEqual(["PUT", "PATCH", "DELETE"]);
  });

  test("throws ApiCallerError with parsed error data on HTTP 4xx", async () => {
    const errorBody = { message: "Invalid parameters", code: "INVALID_INPUT" };

    globalThis.fetch = mock((async () => {
      return new Response(JSON.stringify(errorBody), {
        status: 400,
        statusText: "Bad Request",
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    try {
      await apiCaller.get("https://api.example.com/bad-request");
      expect(true).toBe(false); // should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(ApiCallerError);
      const apiErr = err as ApiCallerError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.statusText).toBe("Bad Request");
      expect(apiErr.data).toEqual(errorBody);
      expect(apiErr.url).toBe("https://api.example.com/bad-request");
      expect(apiErr.method).toBe("GET");
    }
  });

  test("retries on 5xx status codes when retry is configured", async () => {
    let callCount = 0;

    globalThis.fetch = mock((async () => {
      callCount++;
      if (callCount < 3) {
        return new Response("Service Unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        });
      }
      return new Response(JSON.stringify({ recovered: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    const client = createApiClient({ retry: 2, retryDelay: 10 });
    const res = await client.get<{ recovered: boolean }>("https://api.example.com/retry-test");

    expect(callCount).toBe(3);
    expect(res.data.recovered).toBe(true);
  });

  test("invokes logger callbacks if logger is provided", async () => {
    const logs: { type: string; obj: object; msg?: string }[] = [];
    const logger = {
      debug: (obj: object, msg?: string) => logs.push({ type: "debug", obj, msg }),
      info: (obj: object, msg?: string) => logs.push({ type: "info", obj, msg }),
      warn: (obj: object, msg?: string) => logs.push({ type: "warn", obj, msg }),
      error: (obj: object, msg?: string) => logs.push({ type: "error", obj, msg }),
    };

    globalThis.fetch = mock((async () => {
      return new Response(JSON.stringify({ logged: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);

    const client = createApiClient({ logger });
    await client.get("https://api.example.com/logged");

    expect(logs.some((l) => l.type === "debug")).toBe(true);
  });
});
