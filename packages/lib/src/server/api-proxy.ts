import { NextResponse } from "next/server";

export interface ApiProxyRequest {
  nextUrl: { pathname: string; search: string };
  headers: Headers;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const CABECALHOS_REPASSADOS = [
  "accept",
  "content-type",
  "cookie",
  "x-correlation-id",
  "x-request-id",
] as const;

function caminhoBackend(request: ApiProxyRequest): string {
  const indiceApi = request.nextUrl.pathname.indexOf("/api");
  return indiceApi >= 0
    ? request.nextUrl.pathname.slice(indiceApi)
    : `/api${request.nextUrl.pathname}`;
}

function urlBackend(request: ApiProxyRequest): string {
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:3001";
  return `${apiUrl}${caminhoBackend(request)}${request.nextUrl.search}`;
}

export async function proxyRequest(
  request: ApiProxyRequest,
  method: string,
): Promise<Response> {
  const url = urlBackend(request);
  const headers = new Headers();

  for (const nome of CABECALHOS_REPASSADOS) {
    const valor = request.headers.get(nome);
    if (valor) headers.set(nome, valor);
  }

  const options: RequestInit = {
    method,
    headers,
    credentials: "include",
  };

  if (method !== "GET" && method !== "HEAD") {
    const corpo = await request.arrayBuffer();
    if (corpo.byteLength > 0) options.body = corpo;
  }

  try {
    const resposta = await fetch(url, options);
    const corpo = await resposta.arrayBuffer();
    const respostaNext = new NextResponse(corpo, {
      status: resposta.status,
      statusText: resposta.statusText,
    });

    for (const nome of ["content-type", "location", "cache-control", "set-cookie"]) {
      const valor = resposta.headers.get(nome);
      if (valor) respostaNext.headers.set(nome, valor);
    }

    return respostaNext;
  } catch (erro) {
    console.error(`[Proxy Error] ${method} ${url}:`, erro);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PROXY_ERROR",
          message: "Erro de comunicação com o servidor backend",
        },
      },
      { status: 502 },
    );
  }
}
