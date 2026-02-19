import type { ApiResponse } from "../types/index.js";

/**
 * Client-side fetcher with cookie handling and 401 redirect
 * Use this in React components and client-side code
 */

interface FetcherOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export class FetchError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

const API_BASE_URL = "/api";

// Login URL - in production behind reverse proxy, use /login
// In development, each app runs on different port, so use full URL
const getLoginUrl = () => {
  if (typeof window === "undefined") return "/login";
  // Development: redirect to login app on port 3003
  if (window.location.hostname === "localhost") {
    return "http://localhost:3003";
  }
  // Production: same domain, different path
  return "/login";
};

export async function clientFetch<T>(
  endpoint: string,
  options: FetcherOptions = {},
): Promise<T> {
  const { body, headers: customHeaders, ...restOptions } = options;

  const isFormData = body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...customHeaders,
  };

  const config: RequestInit = {
    ...restOptions,
    headers,
    credentials: "include", // Always include cookies
  };

  if (body !== undefined) {
    config.body = isFormData ? (body as BodyInit) : JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, config);

  // Handle 401 - User not authenticated
  if (response.status === 401) {
    // Clear any client-side cache (TanStack Query should handle this)
    // Redirect to login page
    if (typeof window !== "undefined") {
      window.location.href = getLoginUrl();
    }
    throw new FetchError(401, "UNAUTHORIZED", "Sessão expirada");
  }

  // Handle 403 - User authenticated but no permission
  if (response.status === 403) {
    throw new FetchError(403, "FORBIDDEN", "Acesso negado");
  }

  const data = await response.json();

  if (
    !response.ok ||
    (data && typeof data === "object" && "success" in data && !data.success)
  ) {
    // Handle standard NestJS error response (statusCode, message, error)
    if (
      data &&
      typeof data === "object" &&
      "statusCode" in data &&
      "message" in data
    ) {
      throw new FetchError(
        (data as any).statusCode,
        (data as any).error ?? "UNKNOWN_ERROR",
        // NestJS message can be string or array of strings
        Array.isArray((data as any).message)
          ? (data as any).message.join(", ")
          : (data as any).message,
      );
    }

    // Handle ApiResponse format
    const apiResponse = data as ApiResponse<T>;
    throw new FetchError(
      response.status,
      apiResponse.error?.code ?? "UNKNOWN_ERROR",
      apiResponse.error?.message ?? "Erro desconhecido",
      apiResponse.error?.details,
    );
  }

  return (data as ApiResponse<T>).data as T;
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string, options?: FetcherOptions) =>
    clientFetch<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: FetcherOptions) =>
    clientFetch<T>(endpoint, { ...options, method: "POST", body }),

  put: <T>(endpoint: string, body?: unknown, options?: FetcherOptions) =>
    clientFetch<T>(endpoint, { ...options, method: "PUT", body }),

  patch: <T>(endpoint: string, body?: unknown, options?: FetcherOptions) =>
    clientFetch<T>(endpoint, { ...options, method: "PATCH", body }),

  delete: <T>(endpoint: string, options?: FetcherOptions) =>
    clientFetch<T>(endpoint, { ...options, method: "DELETE" }),
};
