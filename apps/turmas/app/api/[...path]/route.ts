/**
 * API Proxy para Backend NestJS
 *
 * Encaminha todas as requisições de /api/* para o backend (API_URL)
 * Preserva cookies (sessão), headers e parâmetros.
 *
 * @route /api/[...path]
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// URL do backend (services/api)
// Default para localhost:3001 em desenvolvimento
const API_URL = process.env.API_URL || "http://localhost:3001";

/**
 * Encaminha a requisição para o backend
 */
async function proxyRequest(
  request: NextRequest,
  method: string,
): Promise<NextResponse> {
  // Extrai o caminho relativo (remove /api/ inicial)
  // Ex: /api/turmas -> /turmas
  // Ex: /api/units/abc/turmas?year=2025 -> /units/abc/turmas?year=2025
  const path = request.nextUrl.pathname.replace(/^\/api/, "");
  const url = `${API_URL}${path}${request.nextUrl.search}`;

  try {
    // Preparar headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Forwarding de autenticação (cookies)
    const cookie = request.headers.get("cookie");
    if (cookie) {
      headers["Cookie"] = cookie;
    }

    // Forwarding de request tracing
    const requestId = request.headers.get("x-request-id");
    if (requestId) {
      headers["x-request-id"] = requestId;
    }

    // Configuração do fetch
    const fetchOptions: RequestInit = {
      method,
      headers,
      credentials: "include", // Importante para cookie handling
    };

    // Processar body para métodos que suportam payload
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // Body vazio ou inválido (ignorar)
      }
    }

    // Executar request ao backend
    const response = await fetch(url, fetchOptions);

    // Ler resposta
    const data = await response.json().catch(() => ({}));

    // Criar resposta Next
    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    // Forwarding de cookies da resposta (ex: set-cookie do login)
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      nextResponse.headers.set("Set-Cookie", setCookie);
    }

    return nextResponse;
  } catch (error) {
    console.error(`[Proxy Error] ${method} ${url}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PROXY_ERROR",
          message: "Erro de comunicação com o servidor backend",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 502 }, // Bad Gateway
    );
  }
}

// Handler para métodos HTTP suportados
export async function GET(request: NextRequest) {
  return proxyRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "POST");
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, "PUT");
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, "PATCH");
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, "DELETE");
}
