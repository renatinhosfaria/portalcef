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
      nome: "planejamento.visualizado",
      origem: "dashboard",
    });
    registrarEventoObservabilidade({
      nome: "planejamento.filtro_aplicado",
      origem: "dashboard",
      metadados: { filtro: "pendentes" },
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
        nome: "planejamento.visualizado",
        origem: "dashboard",
        sessaoObservabilidadeId: expect.any(String),
      }),
    );
    expect(corpo.eventos[1]).toEqual(
      expect.objectContaining({
        nome: "planejamento.filtro_aplicado",
        origem: "dashboard",
        sessaoObservabilidadeId: corpo.eventos[0].sessaoObservabilidadeId,
      }),
    );
  });

  it("remove campos proibidos antes do envio em qualquer profundidade", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    registrarEventoObservabilidade({
      nome: "planejamento.erro",
      origem: "editor",
      usuario: { id: "usuario-nao-confiavel" },
      metadados: {
        token: "segredo",
        dadosPermitidos: "valor",
        nivel: {
          senha: "123",
          headers: { authorization: "Bearer segredo" },
          lista: [
            {
              conteudo: "<p>privado</p>",
              detalhePermitido: "ok",
            },
          ],
        },
      },
      payload: { bruto: true },
    });

    await enviarEventosPendentes();

    const chamadaFetch = vi.mocked(fetch).mock.calls[0];
    expect(chamadaFetch).toBeDefined();
    const [, opcoes] = chamadaFetch!;
    const corpoSerializado = String(opcoes?.body);
    const corpo = JSON.parse(corpoSerializado);

    expect(corpo.eventos[0]).toEqual(
      expect.objectContaining({
        nome: "planejamento.erro",
        origem: "editor",
        metadados: {
          dadosPermitidos: "valor",
          nivel: {
            lista: [{ detalhePermitido: "ok" }],
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

  it("usa fetch com POST, JSON e credenciais include", async () => {
    const { registrarEventoObservabilidade, enviarEventosPendentes } =
      await import("./cliente");

    registrarEventoObservabilidade({
      nome: "planejamento.salvo",
      origem: "editor",
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
      nome: "planejamento.salvo",
      origem: "editor",
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
      nome: "planejamento.visualizado",
      origem: "dashboard",
    });
    await enviarEventosPendentes();

    expect(acessoLocalStorage).not.toHaveBeenCalled();
  });
});
