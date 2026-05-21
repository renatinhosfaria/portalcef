"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { registrarEventoObservabilidade } from "./cliente";
import type { EventoObservabilidadeCliente } from "./types";

const MODULO_OBSERVABILIDADE = "planejamento";
const LIMITE_API_LENTA_MS = 2000;
const ENDPOINT_OBSERVABILIDADE =
  "/api/planejamento-observabilidade/eventos";
const UUID_SIMPLES =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi;

interface ObservabilidadeProviderProps {
  children: ReactNode;
}

function gerarCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `correlation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function obterMensagemErro(valor: unknown): string {
  if (valor instanceof Error) {
    return valor.message;
  }

  if (typeof valor === "string") {
    return valor;
  }

  return "Erro desconhecido";
}

function obterCodigoErro(valor: unknown): string {
  if (valor instanceof Error && valor.name) {
    return valor.name;
  }

  return "ErroDesconhecido";
}

function obterStackResumo(valor: unknown): string | undefined {
  if (!(valor instanceof Error) || !valor.stack) {
    return undefined;
  }

  return valor.stack.split("\n").slice(0, 5).join("\n");
}

function normalizarRota(url: string): string {
  const base =
    typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const urlNormalizada = new URL(url, base);

  return urlNormalizada.pathname.replace(UUID_SIMPLES, "/:id");
}

function deveInterceptarRota(url: string): boolean {
  try {
    const rota = normalizarRota(url);

    return rota.startsWith("/api/") && rota !== ENDPOINT_OBSERVABILIDADE;
  } catch {
    return false;
  }
}

function extrairMetodo(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (input instanceof Request && input.method) {
    return input.method.toUpperCase();
  }

  return "GET";
}

function extrairUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function criarHeadersComCorrelationId(
  input: RequestInfo | URL,
  init?: RequestInit,
): { headers: Headers; correlationId: string } {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);

  if (init?.headers) {
    new Headers(init.headers).forEach((valor, chave) => {
      headers.set(chave, valor);
    });
  }

  const correlationId = headers.get("x-correlation-id") ?? gerarCorrelationId();
  headers.set("x-correlation-id", correlationId);

  return { headers, correlationId };
}

function registrarErroGlobal(acao: string, erro: unknown): void {
  registrarEventoObservabilidade({
    evento: "erro_navegador",
    nivel: "error",
    erro: {
      codigo: obterCodigoErro(erro),
      mensagem: obterMensagemErro(erro),
      stackResumo: obterStackResumo(erro),
    },
    detalhes: {
      modulo: MODULO_OBSERVABILIDADE,
      acao,
      online:
        typeof navigator !== "undefined" ? navigator.onLine : undefined,
    },
  });
}

function montarEventoApi(
  evento: "api_chamada" | "api_lenta",
  nivel: EventoObservabilidadeCliente["nivel"],
  metodo: string,
  rota: string,
  status: number | undefined,
  duracaoMs: number,
  correlationId: string,
  erro?: unknown,
): EventoObservabilidadeCliente {
  return {
    evento,
    nivel,
    correlationId,
    http: {
      metodo,
      rota,
      status,
      duracaoMs,
    },
    erro:
      erro === undefined
        ? undefined
        : {
            codigo: obterCodigoErro(erro),
            mensagem: obterMensagemErro(erro),
            stackResumo: obterStackResumo(erro),
          },
    detalhes: {
      modulo: MODULO_OBSERVABILIDADE,
      acao: "fetch",
      status: nivel === "error" ? "erro" : "sucesso",
      duracaoMs,
      ...(evento === "api_lenta"
        ? {
            limiteMs: LIMITE_API_LENTA_MS,
            lento: true,
          }
        : {}),
    },
  };
}

export function ObservabilidadeProvider({
  children,
}: ObservabilidadeProviderProps) {
  const pathname = usePathname();

  useEffect(() => {
    registrarEventoObservabilidade({
      evento: "pagina_aberta",
      pagina: {
        url: pathname ?? window.location.pathname,
        titulo: document.title,
      },
      detalhes: {
        modulo: MODULO_OBSERVABILIDADE,
        acao: "abrir_pagina",
      },
    });
  }, [pathname]);

  useEffect(() => {
    function aoErro(evento: ErrorEvent) {
      registrarErroGlobal("window_error", evento.error ?? evento.message);
    }

    function aoRejeitarPromessa(evento: PromiseRejectionEvent) {
      registrarErroGlobal("unhandledrejection", evento.reason);
    }

    window.addEventListener("error", aoErro);
    window.addEventListener("unhandledrejection", aoRejeitarPromessa);

    return () => {
      window.removeEventListener("error", aoErro);
      window.removeEventListener("unhandledrejection", aoRejeitarPromessa);
    };
  }, []);

  useEffect(() => {
    const fetchOriginal = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = extrairUrl(input);

      if (!deveInterceptarRota(url)) {
        return fetchOriginal.call(window, input, init);
      }

      const inicio = performance.now();
      const metodo = extrairMetodo(input, init);
      const rota = normalizarRota(url);
      const { headers, correlationId } = criarHeadersComCorrelationId(input, init);
      const initComCorrelationId = {
        ...init,
        headers,
      };

      try {
        const resposta = await fetchOriginal.call(window, input, initComCorrelationId);
        const duracaoMs = Math.round(performance.now() - inicio);
        const nivel = resposta.ok ? "info" : "error";

        registrarEventoObservabilidade(
          montarEventoApi(
            "api_chamada",
            nivel,
            metodo,
            rota,
            resposta.status,
            duracaoMs,
            correlationId,
          ),
        );

        if (duracaoMs > LIMITE_API_LENTA_MS) {
          registrarEventoObservabilidade(
            montarEventoApi(
              "api_lenta",
              "warn",
              metodo,
              rota,
              resposta.status,
              duracaoMs,
              correlationId,
            ),
          );
        }

        return resposta;
      } catch (erro) {
        const duracaoMs = Math.round(performance.now() - inicio);

        registrarEventoObservabilidade(
          montarEventoApi(
            "api_chamada",
            "error",
            metodo,
            rota,
            undefined,
            duracaoMs,
            correlationId,
            erro,
          ),
        );

        throw erro;
      }
    };

    return () => {
      window.fetch = fetchOriginal;
    };
  }, []);

  return children;
}
