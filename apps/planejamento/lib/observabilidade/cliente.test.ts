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
        },
      }),
    );
    expect(corpoSerializado).not.toContain("usuario-nao-confiavel");
    expect(corpoSerializado).not.toContain("segredo");
    expect(corpoSerializado).not.toContain("authorization");
    expect(corpoSerializado).not.toContain("privado");
    expect(corpoSerializado).not.toContain("bruto");
    expect(corpoSerializado).not.toContain("lista");
  });

  it("remove chaves fora da allowlist de detalhes em qualquer profundidade", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    const eventoComDetalhesInvalidos = {
      evento: "arquivo_acao",
      detalhes: {
        modulo: "planejamento",
        acao: "baixar",
        contexto: "fora-da-allowlist",
        aninhado: {
          resultado: "ok",
          segredoInterno: "nao_deve_ir",
        },
        itens: [
          {
            tipo: "documento",
            valorLivre: "nao_deve_ir",
          },
        ],
        resultado: [
          {
            tipo: "pdf",
            sistema: "sharepoint",
            chaveLivre: "nao_deve_ir",
          },
        ],
      },
    } as unknown as Parameters<typeof registrarEventoObservabilidade>[0];

    registrarEventoObservabilidade(eventoComDetalhesInvalidos);

    await enviarEventosPendentes();

    const chamadaFetch = vi.mocked(fetch).mock.calls[0];
    expect(chamadaFetch).toBeDefined();
    const [, opcoes] = chamadaFetch!;
    const corpoSerializado = String(opcoes?.body);
    const corpo = JSON.parse(corpoSerializado);

    expect(corpo.eventos[0]).toEqual(
      expect.objectContaining({
        evento: "arquivo_acao",
        origem: "browser",
        detalhes: {
          modulo: "planejamento",
          acao: "baixar",
          resultado: [
            {
              tipo: "pdf",
              sistema: "sharepoint",
            },
          ],
        },
      }),
    );
    expect(corpoSerializado).not.toContain("fora-da-allowlist");
    expect(corpoSerializado).not.toContain("aninhado");
    expect(corpoSerializado).not.toContain("segredoInterno");
    expect(corpoSerializado).not.toContain("itens");
    expect(corpoSerializado).not.toContain("valorLivre");
    expect(corpoSerializado).not.toContain("chaveLivre");
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

  it("normaliza valores inválidos para preservar a aderência ao DTO da API", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");
    const texto = (tamanho: number) => "x".repeat(tamanho);
    const itensDetalhes = Array.from({ length: 25 }, (_, indice) => ({
      tipo: `item-${indice}`,
      quantidade: indice,
    }));

    const eventoInvalido = {
      evento: "api_lenta",
      timestamp: "agora",
      correlationId: texto(130),
      requestId: texto(130),
      http: {
        metodo: texto(130),
        rota: texto(2100),
        status: 999,
        duracaoMs: Number.POSITIVE_INFINITY,
      },
      pagina: {
        url: texto(2100),
        titulo: texto(250),
      },
      arquivo: {
        planoId: texto(130),
        provaId: texto(130),
        relatorioId: texto(130),
        documentoId: texto(130),
        nome: texto(300),
        tipo: texto(130),
        tamanhoBytes: -1,
      },
      erro: {
        codigo: texto(130),
        mensagem: texto(600),
        stackResumo: texto(1100),
      },
      detalhes: {
        modulo: texto(600),
        duracaoMs: Number.NaN,
        duracaoTotalMs: Number.POSITIVE_INFINITY,
        tamanhoBytes: -50,
        quantidade: 3,
        resultado: itensDetalhes,
        fallback: {
          resultado: {
            sistema: {
              tipo: {
                status: "profundo-demais",
              },
            },
          },
        },
      },
    } as unknown as Parameters<typeof registrarEventoObservabilidade>[0];

    registrarEventoObservabilidade(eventoInvalido);

    await enviarEventosPendentes();

    const chamadaFetch = vi.mocked(fetch).mock.calls[0];
    expect(chamadaFetch).toBeDefined();
    const [, opcoes] = chamadaFetch!;
    const corpoSerializado = String(opcoes?.body);
    const corpo = JSON.parse(corpoSerializado);
    const evento = corpo.eventos[0];

    expect(evento).toEqual(
      expect.objectContaining({
        evento: "api_lenta",
        origem: "browser",
        correlationId: texto(120),
        requestId: texto(120),
        http: {
          metodo: texto(120),
          rota: texto(2000),
        },
        pagina: {
          url: texto(2000),
          titulo: texto(200),
        },
        arquivo: {
          planoId: texto(120),
          provaId: texto(120),
          relatorioId: texto(120),
          documentoId: texto(120),
          nome: texto(255),
          tipo: texto(120),
        },
        erro: {
          codigo: texto(120),
          mensagem: texto(500),
          stackResumo: texto(1000),
        },
        detalhes: {
          modulo: texto(500),
          quantidade: 3,
          resultado: itensDetalhes.slice(0, 20),
        },
      }),
    );
    expect(evento).not.toHaveProperty("timestamp");
    expect(evento.http).not.toHaveProperty("status");
    expect(evento.http).not.toHaveProperty("duracaoMs");
    expect(evento.arquivo).not.toHaveProperty("tamanhoBytes");
    expect(evento.detalhes).not.toHaveProperty("duracaoMs");
    expect(evento.detalhes).not.toHaveProperty("duracaoTotalMs");
    expect(evento.detalhes).not.toHaveProperty("tamanhoBytes");
    expect(evento.detalhes).not.toHaveProperty("fallback");
    expect(corpoSerializado).not.toContain("profundo-demais");
    expect(corpoSerializado).not.toContain("null");
  });

  it("descarta eventos fora do enum sem derrubar eventos válidos do lote", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    registrarEventoObservabilidade({
      evento: "evento_invalido",
      detalhes: {
        modulo: "planejamento",
      },
    } as unknown as Parameters<typeof registrarEventoObservabilidade>[0]);
    registrarEventoObservabilidade({
      evento: "pagina_aberta",
      timestamp: "2026-01-01T00:00:00.000Z",
      detalhes: {
        modulo: "planejamento",
        acao: "abrir_pagina",
      },
    });

    await enviarEventosPendentes();

    expect(fetch).toHaveBeenCalledTimes(1);
    const chamadaFetch = vi.mocked(fetch).mock.calls[0];
    expect(chamadaFetch).toBeDefined();
    const [, opcoes] = chamadaFetch!;
    const corpoSerializado = String(opcoes?.body);
    const corpo = JSON.parse(corpoSerializado);

    expect(corpo.eventos).toHaveLength(1);
    expect(corpo.eventos[0]).toEqual(
      expect.objectContaining({
        evento: "pagina_aberta",
        origem: "browser",
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(corpoSerializado).not.toContain("evento_invalido");
  });

  it("remove timestamps aceitos por Date.parse mas rejeitados pelo DTO", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    const timestampsInvalidos = [
      "2026-01-01",
      "2026-01-01T00:00:00",
      "Thu, 01 Jan 2026 00:00:00 GMT",
      "2026-01-01T00:00:00-03:00",
    ];

    timestampsInvalidos.forEach((timestamp) => {
      registrarEventoObservabilidade({
        evento: "api_chamada",
        timestamp,
        detalhes: {
          modulo: "planejamento",
        },
      });
    });
    registrarEventoObservabilidade({
      evento: "api_chamada",
      timestamp: "2026-01-01T00:00:00Z",
      detalhes: {
        modulo: "planejamento",
      },
    });

    await enviarEventosPendentes();

    const chamadaFetch = vi.mocked(fetch).mock.calls[0];
    expect(chamadaFetch).toBeDefined();
    const [, opcoes] = chamadaFetch!;
    const corpoSerializado = String(opcoes?.body);
    const corpo = JSON.parse(corpoSerializado);

    expect(corpo.eventos).toHaveLength(5);
    expect(corpo.eventos[0]).not.toHaveProperty("timestamp");
    expect(corpo.eventos[1]).not.toHaveProperty("timestamp");
    expect(corpo.eventos[2]).not.toHaveProperty("timestamp");
    expect(corpo.eventos[3]).not.toHaveProperty("timestamp");
    expect(corpo.eventos[4]).toEqual(
      expect.objectContaining({
        timestamp: "2026-01-01T00:00:00Z",
      }),
    );
    expect(corpoSerializado).not.toContain("Thu, 01 Jan");
    expect(corpoSerializado).not.toContain("-03:00");
  });

  it("ignora entradas não objeto e envia apenas eventos válidos", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    [
      null,
      undefined,
      "evento",
      123,
    ].forEach((entrada) => {
      registrarEventoObservabilidade(
        entrada as unknown as Parameters<typeof registrarEventoObservabilidade>[0],
      );
    });
    registrarEventoObservabilidade({
      evento: "api_chamada",
      detalhes: {
        modulo: "planejamento",
      },
    });

    await expect(enviarEventosPendentes()).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(1);
    const chamadaFetch = vi.mocked(fetch).mock.calls[0];
    expect(chamadaFetch).toBeDefined();
    const [, opcoes] = chamadaFetch!;
    const corpo = JSON.parse(String(opcoes?.body));

    expect(corpo.eventos).toHaveLength(1);
    expect(corpo.eventos[0]).toEqual(
      expect.objectContaining({
        evento: "api_chamada",
        origem: "browser",
      }),
    );
  });

  it("descarta BigInt em detalhes sem impedir envio do lote", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    registrarEventoObservabilidade({
      evento: "api_chamada",
      detalhes: {
        modulo: "planejamento",
        quantidade: BigInt(10),
        resultado: [
          {
            tipo: "ok",
            quantidade: BigInt(2),
          },
        ],
      },
    } as unknown as Parameters<typeof registrarEventoObservabilidade>[0]);
    registrarEventoObservabilidade({
      evento: "pagina_aberta",
      detalhes: {
        modulo: "planejamento",
        acao: "abrir_pagina",
      },
    });

    await expect(enviarEventosPendentes()).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(1);
    const chamadaFetch = vi.mocked(fetch).mock.calls[0];
    expect(chamadaFetch).toBeDefined();
    const [, opcoes] = chamadaFetch!;
    const corpoSerializado = String(opcoes?.body);
    const corpo = JSON.parse(corpoSerializado);

    expect(corpo.eventos).toHaveLength(2);
    expect(corpo.eventos[0].detalhes).toEqual({
      modulo: "planejamento",
      resultado: [{ tipo: "ok" }],
    });
    expect(corpo.eventos[1]).toEqual(
      expect.objectContaining({
        evento: "pagina_aberta",
      }),
    );
    expect(JSON.stringify(corpo.eventos[0].detalhes)).not.toContain("10");
  });

  it("não rejeita quando AbortController não está disponível", async () => {
    vi.stubGlobal("AbortController", undefined);
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
