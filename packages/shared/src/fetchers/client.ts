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

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  const config: RequestInit = {
    ...restOptions,
    headers,
    credentials: "include", // Always include cookies
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
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

  const data = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !data.success) {
    throw new FetchError(
      response.status,
      data.error?.code ?? "UNKNOWN_ERROR",
      data.error?.message ?? "Erro desconhecido",
    );
  }

  return data.data as T;
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
