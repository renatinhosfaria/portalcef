import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("cliente de observabilidade", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gera sessaoObservabilidadeId uma vez por aba", async () => {
    const { obterSessaoObservabilidadeId } = await import("./cliente");

    const primeiraLeitura = obterSessaoObservabilidadeId();
    const segundaLeitura = obterSessaoObservabilidadeId();

    expect(primeiraLeitura).toBeTruthy();
    expect(segundaLeitura).toBe(primeiraLeitura);
  });

  it("envia eventos em lote para o endpoint de ingestão", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    registrarEventoObservabilidade({
      evento: "pagina_aberta",
      pagina: {
        url: "/planejamento",
        titulo: "Planejamento",
      },
      detalhes: {
        modulo: "planejamento",
        acao: "abrir_pagina",
      },
    });
    registrarEventoObservabilidade({
      evento: "api_chamada",
      http: {
        metodo: "GET",
        rota: "/api/planejamentos",
        status: 200,
        duracaoMs: 120,
      },
      detalhes: {
        modulo: "planejamento",
        acao: "listar",
        status: "sucesso",
      },
    });

    await enviarEventosPendentes();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/planejamento-observabilidade/eventos",
      expect.objectContaining({
        body: expect.any(String),
      }),
    );

    const chamadaFetch = vi.mocked(fetch).mock.calls[0];
    expect(chamadaFetch).toBeDefined();
    const [, opcoes] = chamadaFetch!;
    const corpo = JSON.parse(String(opcoes?.body));

    expect(corpo.eventos).toHaveLength(2);
    expect(corpo.eventos[0]).toEqual(
      expect.objectContaining({
        evento: "pagina_aberta",
        origem: "browser",
        sessaoObservabilidadeId: expect.any(String),
        pagina: {
          url: "/planejamento",
          titulo: "Planejamento",
        },
        detalhes: {
          modulo: "planejamento",
          acao: "abrir_pagina",
        },
      }),
    );
    expect(corpo.eventos[1]).toEqual(
      expect.objectContaining({
        evento: "api_chamada",
        origem: "browser",
        sessaoObservabilidadeId: corpo.eventos[0].sessaoObservabilidadeId,
        http: {
          metodo: "GET",
          rota: "/api/planejamentos",
          status: 200,
          duracaoMs: 120,
        },
        detalhes: {
          modulo: "planejamento",
          acao: "listar",
          status: "sucesso",
        },
      }),
    );
    expect(corpo.eventos[0]).not.toHaveProperty("nome");
    expect(corpo.eventos[1]).not.toHaveProperty("nome");
  });

  it("remove campos proibidos antes do envio em qualquer profundidade", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    const eventoComCamposProibidos = {
      evento: "erro_navegador",
      origem: "dashboard",
      usuario: { id: "usuario-nao-confiavel" },
      detalhes: {
        token: "segredo",
        modulo: "planejamento",
        acao: "salvar",
        status: "erro",
        nivel: {
          senha: "123",
          headers: { authorization: "Bearer segredo" },
          lista: [
            {
              conteudo: "<p>privado</p>",
              resultado: "ok",
            },
          ],
        },
      },
      payload: { bruto: true },
    } as unknown as Parameters<typeof registrarEventoObservabilidade>[0];

    registrarEventoObservabilidade(eventoComCamposProibidos);

    await enviarEventosPendentes();

    const chamadaFetch = vi.mocked(fetch).mock.calls[0];
    expect(chamadaFetch).toBeDefined();
    const [, opcoes] = chamadaFetch!;
    const corpoSerializado = String(opcoes?.body);
    const corpo = JSON.parse(corpoSerializado);

    expect(corpo.eventos[0]).toEqual(
      expect.objectContaining({
        evento: "erro_navegador",
        origem: "browser",
        detalhes: {
          modulo: "planejamento",
          acao: "salvar",
          status: "erro",
          nivel: {
            lista: [{ resultado: "ok" }],
          },
        },
      }),
    );
    expect(corpoSerializado).not.toContain("usuario-nao-confiavel");
    expect(corpoSerializado).not.toContain("segredo");
    expect(corpoSerializado).not.toContain("authorization");
    expect(corpoSerializado).not.toContain("privado");
    expect(corpoSerializado).not.toContain("bruto");
  });

  it("remove campos extras fora do contrato mesmo quando a entrada vem de JS", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    const eventoComCamposExtras = {
      evento: "api_lenta",
      nome: "planejamento.legado",
      metadados: {
        modulo: "nao_deve_ir",
      },
      campoExtra: "fora-do-dto",
      http: {
        metodo: "POST",
        rota: "/api/planejamentos",
        status: 200,
        duracaoMs: 900,
        headers: {
          authorization: "Bearer segredo",
        },
        campoHttpExtra: "fora-do-dto",
      },
      detalhes: {
        modulo: "planejamento",
        acao: "salvar",
        duracaoMs: 900,
        token: "segredo",
      },
    } as unknown as Parameters<typeof registrarEventoObservabilidade>[0];

    registrarEventoObservabilidade(eventoComCamposExtras);

    await enviarEventosPendentes();

    const chamadaFetch = vi.mocked(fetch).mock.calls[0];
    expect(chamadaFetch).toBeDefined();
    const [, opcoes] = chamadaFetch!;
    const corpoSerializado = String(opcoes?.body);
    const corpo = JSON.parse(corpoSerializado);

    expect(corpo.eventos[0]).toEqual({
      evento: "api_lenta",
      origem: "browser",
      sessaoObservabilidadeId: expect.any(String),
      http: {
        metodo: "POST",
        rota: "/api/planejamentos",
        status: 200,
        duracaoMs: 900,
      },
      detalhes: {
        modulo: "planejamento",
        acao: "salvar",
        duracaoMs: 900,
      },
    });
    expect(corpoSerializado).not.toContain("planejamento.legado");
    expect(corpoSerializado).not.toContain("metadados");
    expect(corpoSerializado).not.toContain("fora-do-dto");
    expect(corpoSerializado).not.toContain("segredo");
  });

  it("usa fetch com POST, JSON e credenciais include", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    registrarEventoObservabilidade({
      evento: "arquivo_acao",
      arquivo: {
        planoId: "plano-1",
      },
      detalhes: {
        modulo: "planejamento",
        acao: "salvar",
      },
    });

    await enviarEventosPendentes();

    expect(fetch).toHaveBeenCalledWith(
      "/api/planejamento-observabilidade/eventos",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("falha de envio não rejeita para quem chamou", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede fora")));
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    registrarEventoObservabilidade({
      evento: "api_chamada",
      detalhes: {
        modulo: "planejamento",
        acao: "salvar",
      },
    });

    await expect(enviarEventosPendentes()).resolves.toBeUndefined();
  });

  it("não usa localStorage", async () => {
    const acessoLocalStorage = vi.fn(() => {
      throw new Error("localStorage não deve ser acessado");
    });

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: acessoLocalStorage,
    });
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: acessoLocalStorage,
    });

    const {
      obterSessaoObservabilidadeId,
      registrarEventoObservabilidade,
      enviarEventosPendentes,
    } = await import("./cliente");

    obterSessaoObservabilidadeId();
    registrarEventoObservabilidade({
      evento: "pagina_aberta",
      detalhes: {
        modulo: "planejamento",
        acao: "abrir_pagina",
      },
    });
    await enviarEventosPendentes();

    expect(acessoLocalStorage).not.toHaveBeenCalled();
  });
});
