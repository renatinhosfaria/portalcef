import type { ApiResponse } from "../types/index.js";

/**
 * Server-side fetcher for Next.js Server Components and Route Handlers
 * Use this in server components, server actions, and route handlers
 */

interface ServerFetcherOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  cookies?: string;
}

export class ServerFetchError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServerFetchError";
  }
}

// In production, this should be the internal Docker network URL
// In development, use localhost
const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function serverFetch<T>(
  endpoint: string,
  options: ServerFetcherOptions = {},
): Promise<T> {
  const { body, headers: customHeaders, cookies, ...restOptions } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  // Forward cookies from the incoming request
  if (cookies) {
    (headers as Record<string, string>)["Cookie"] = cookies;
  }

  const config: RequestInit = {
    ...restOptions,
    headers,
    // Default to no-store for private data
    cache: restOptions.cache ?? "no-store",
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const url = `${API_INTERNAL_URL}${endpoint}`;
  const response = await fetch(url, config);

  // Handle 401 - Throw for the page/layout to handle with redirect
  if (response.status === 401) {
    throw new ServerFetchError(401, "UNAUTHORIZED", "Não autenticado");
  }

  // Handle 403 - Throw for the page/layout to handle
  if (response.status === 403) {
    throw new ServerFetchError(403, "FORBIDDEN", "Acesso negado");
  }

  const data = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !data.success) {
    throw new ServerFetchError(
      response.status,
      data.error?.code ?? "UNKNOWN_ERROR",
      data.error?.message ?? "Erro desconhecido",
    );
  }

  return data.data as T;
}

// Convenience methods
export const serverApi = {
  get: <T>(endpoint: string, options?: ServerFetcherOptions) =>
    serverFetch<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: ServerFetcherOptions) =>
    serverFetch<T>(endpoint, { ...options, method: "POST", body }),

  put: <T>(endpoint: string, body?: unknown, options?: ServerFetcherOptions) =>
    serverFetch<T>(endpoint, { ...options, method: "PUT", body }),

  patch: <T>(
    endpoint: string,
    body?: unknown,
    options?: ServerFetcherOptions,
  ) => serverFetch<T>(endpoint, { ...options, method: "PATCH", body }),

  delete: <T>(endpoint: string, options?: ServerFetcherOptions) =>
    serverFetch<T>(endpoint, { ...options, method: "DELETE" }),
};
