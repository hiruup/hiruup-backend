export interface ApiClientLogger {
  debug?: (obj: object, msg?: string) => void;
  info?: (obj: object, msg?: string) => void;
  warn?: (obj: object, msg?: string) => void;
  error?: (obj: object, msg?: string) => void;
}

export interface ApiClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  retry?: number;
  retryDelay?: number;
  logger?: ApiClientLogger;
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export class ApiCallerError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly data: unknown,
    public readonly url: string,
    public readonly method: string,
  ) {
    super(message);
    this.name = "ApiCallerError";
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly retry: number;
  private readonly retryDelay: number;
  private readonly logger?: ApiClientLogger;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.headers = options.headers ?? {};
    this.retry = options.retry ?? 0;
    this.retryDelay = options.retryDelay ?? 100;
    this.logger = options.logger;
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | null | undefined>,
  ): string {
    let fullUrl = endpoint;
    if (this.baseUrl && !/^https?:\/\//i.test(endpoint)) {
      const base = this.baseUrl.replace(/\/+$/, "");
      const path = endpoint.replace(/^\/+/, "");
      fullUrl = `${base}/${path}`;
    }

    if (!params) return fullUrl;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }

    const queryString = searchParams.toString();
    if (!queryString) return fullUrl;

    const separator = fullUrl.includes("?") ? "&" : "?";
    return `${fullUrl}${separator}${queryString}`;
  }

  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const { params, headers: customHeaders, method = "GET", body, ...customInit } = options;
    const url = this.buildUrl(endpoint, params);

    const mergedHeaders = new Headers(this.headers);
    if (customHeaders) {
      if (customHeaders instanceof Headers) {
        customHeaders.forEach((val, key) => mergedHeaders.set(key, val));
      } else if (Array.isArray(customHeaders)) {
        for (const [key, val] of customHeaders) {
          mergedHeaders.set(key, val);
        }
      } else {
        for (const [key, val] of Object.entries(customHeaders)) {
          mergedHeaders.set(key, val);
        }
      }
    }

    let formattedBody = body;
    if (
      body &&
      typeof body === "object" &&
      !(body instanceof FormData) &&
      !(body instanceof Blob) &&
      !(body instanceof ArrayBuffer) &&
      !(body instanceof URLSearchParams)
    ) {
      if (!mergedHeaders.has("content-type")) {
        mergedHeaders.set("content-type", "application/json");
      }
      formattedBody = JSON.stringify(body);
    }

    const init: RequestInit = {
      ...customInit,
      method,
      headers: mergedHeaders,
      body: formattedBody,
    };

    let attempt = 0;
    const maxAttempts = 1 + this.retry;

    while (attempt < maxAttempts) {
      attempt++;
      this.logger?.debug?.({ url, method, attempt }, "Executing HTTP request");

      try {
        const response = await fetch(url, init);

        if (!response.ok) {
          let errorData: unknown;
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              errorData = await response.json();
            } catch {
              errorData = await response.text();
            }
          } else {
            errorData = await response.text();
          }

          if (response.status >= 500 && attempt < maxAttempts) {
            this.logger?.warn?.(
              { status: response.status, attempt, url },
              "HTTP request returned 5xx, retrying...",
            );
            if (this.retryDelay > 0) {
              await new Promise((res) => setTimeout(res, this.retryDelay));
            }
            continue;
          }

          throw new ApiCallerError(
            `Request failed with status ${response.status}`,
            response.status,
            response.statusText,
            errorData,
            url,
            method,
          );
        }

        let parsedData: T;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          parsedData = (await response.json()) as T;
        } else {
          parsedData = (await response.text()) as unknown as T;
        }

        return {
          data: parsedData,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        };
      } catch (err) {
        if (err instanceof ApiCallerError) {
          throw err;
        }
        if (attempt < maxAttempts) {
          this.logger?.warn?.({ err, attempt, url }, "Fetch error, retrying...");
          if (this.retryDelay > 0) {
            await new Promise((res) => setTimeout(res, this.retryDelay));
          }
          continue;
        }
        throw err;
      }
    }

    throw new Error(`Request failed after ${maxAttempts} attempts`);
  }

  async get<T = unknown>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "POST", body: body as BodyInit });
  }

  async put<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body: body as BodyInit });
  }

  async patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "PATCH", body: body as BodyInit });
  }

  async delete<T = unknown>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export function createApiClient(options?: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}

export const apiCaller = new ApiClient();
