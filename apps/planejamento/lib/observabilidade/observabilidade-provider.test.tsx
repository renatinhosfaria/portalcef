import { render, waitFor } from "@testing-library/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  enviarEventosPendentes,
  registrarEventoObservabilidade,
} from "./cliente";
import { ObservabilidadeProvider } from "./observabilidade-provider";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("./cliente", () => ({
  enviarEventosPendentes: vi.fn(),
  registrarEventoObservabilidade: vi.fn(),
}));

function renderizarProvider(children: ReactNode = <span>Conteúdo</span>) {
  return render(<ObservabilidadeProvider>{children}</ObservabilidadeProvider>);
}

function mockFetchSucesso(status = 200) {
  return vi.fn().mockResolvedValue(new Response(null, { status }));
}

describe("ObservabilidadeProvider", () => {
  const fetchOriginal = window.fetch;
  let agora = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enviarEventosPendentes).mockResolvedValue(undefined);
    vi.mocked(usePathname).mockReturnValue("/planejamento");
    document.title = "Planejamento | Essência";
    agora = 100;
    vi.spyOn(performance, "now").mockImplementation(() => agora);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "correlation-id-1"),
    });
    window.fetch = mockFetchSucesso() as unknown as typeof window.fetch;
  });

  afterEach(() => {
    window.fetch = fetchOriginal;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("registra pagina_aberta ao montar", async () => {
    renderizarProvider();

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "pagina_aberta",
          pagina: {
            url: "/planejamento",
            titulo: "Planejamento | Essência",
          },
          detalhes: {
            modulo: "planejamento",
            acao: "abrir_pagina",
          },
        }),
      );
    });
    expect(enviarEventosPendentes).toHaveBeenCalledTimes(1);
  });

  it("registra erro_navegador em window.error e envia a fila", async () => {
    renderizarProvider();
    vi.mocked(registrarEventoObservabilidade).mockClear();
    vi.mocked(enviarEventosPendentes).mockClear();

    const erro = new Error("Falha na tela");
    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "Falha na tela",
        error: erro,
      }),
    );

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "erro_navegador",
          nivel: "error",
          erro: expect.objectContaining({
            codigo: "Error",
            mensagem: "Falha na tela",
            stackResumo: expect.any(String),
          }),
          detalhes: expect.objectContaining({
            modulo: "planejamento",
            acao: "window_error",
          }),
        }),
      );
    });
    expect(enviarEventosPendentes).toHaveBeenCalledTimes(1);
  });

  it("registra erro_navegador em unhandledrejection e envia a fila", async () => {
    renderizarProvider();
    vi.mocked(registrarEventoObservabilidade).mockClear();
    vi.mocked(enviarEventosPendentes).mockClear();

    const erro = new Error("Promessa rejeitada");
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.reject(erro).catch(() => undefined),
        reason: erro,
      }),
    );

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "erro_navegador",
          nivel: "error",
          erro: expect.objectContaining({
            codigo: "Error",
            mensagem: "Promessa rejeitada",
            stackResumo: expect.any(String),
          }),
          detalhes: expect.objectContaining({
            modulo: "planejamento",
            acao: "unhandledrejection",
          }),
        }),
      );
    });
    expect(enviarEventosPendentes).toHaveBeenCalledTimes(1);
  });

  it("intercepta fetch para /api/plano-aula/meus, adiciona x-correlation-id, mede duração, registra api_chamada e envia a fila", async () => {
    const fetchMock = mockFetchSucesso(201);
    window.fetch = fetchMock as unknown as typeof window.fetch;
    renderizarProvider();
    vi.mocked(registrarEventoObservabilidade).mockClear();
    vi.mocked(enviarEventosPendentes).mockClear();

    const requisicao = window.fetch("/api/plano-aula/meus?turmaId=turma-1", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });
    agora = 245;
    await requisicao;

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plano-aula/meus?turmaId=turma-1",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("x-correlation-id")).toBe("correlation-id-1");
    expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "api_chamada",
        nivel: "info",
        correlationId: "correlation-id-1",
        http: {
          metodo: "POST",
          rota: "/api/plano-aula/meus",
          status: 201,
          duracaoMs: 145,
        },
      }),
    );
    expect(enviarEventosPendentes).toHaveBeenCalledTimes(1);
  });

  it("registra api_lenta e envia a fila quando duração ultrapassa 2000 ms", async () => {
    window.fetch = mockFetchSucesso(200) as unknown as typeof window.fetch;
    renderizarProvider();
    vi.mocked(registrarEventoObservabilidade).mockClear();
    vi.mocked(enviarEventosPendentes).mockClear();

    const requisicao = window.fetch("/api/plano-aula/meus");
    agora = 2201;
    await requisicao;

    expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "api_lenta",
        nivel: "warn",
        correlationId: "correlation-id-1",
        http: expect.objectContaining({
          rota: "/api/plano-aula/meus",
          duracaoMs: 2101,
        }),
        detalhes: expect.objectContaining({
          limiteMs: 2000,
          lento: true,
        }),
      }),
    );
    expect(enviarEventosPendentes).toHaveBeenCalledTimes(2);
  });

  it("mantém o fetch original quando o envio da fila falha", async () => {
    const fetchMock = mockFetchSucesso(200);
    vi.mocked(enviarEventosPendentes).mockRejectedValue(
      new Error("Falha no envio"),
    );
    window.fetch = fetchMock as unknown as typeof window.fetch;
    renderizarProvider();
    vi.mocked(registrarEventoObservabilidade).mockClear();
    vi.mocked(enviarEventosPendentes).mockClear();

    await expect(window.fetch("/api/plano-aula/meus")).resolves.toEqual(
      expect.objectContaining({
        status: 200,
      }),
    );

    expect(enviarEventosPendentes).toHaveBeenCalledTimes(1);
  });

  it("não intercepta /api/planejamento-observabilidade/eventos", async () => {
    const fetchMock = mockFetchSucesso(204);
    window.fetch = fetchMock as unknown as typeof window.fetch;
    renderizarProvider();
    vi.mocked(registrarEventoObservabilidade).mockClear();

    await window.fetch("/api/planejamento-observabilidade/eventos", {
      method: "POST",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/planejamento-observabilidade/eventos",
      {
        method: "POST",
      },
    );
    expect(registrarEventoObservabilidade).not.toHaveBeenCalled();
  });

  it("restaura window.fetch ao desmontar", () => {
    const fetchMock = mockFetchSucesso();
    window.fetch = fetchMock as unknown as typeof window.fetch;

    const { unmount } = renderizarProvider();
    expect(window.fetch).not.toBe(fetchMock);

    unmount();

    expect(window.fetch).toBe(fetchMock);
  });
});
