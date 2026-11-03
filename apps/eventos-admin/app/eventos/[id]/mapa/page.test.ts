// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapaPage from "./page";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "evento-1" }), useRouter: () => ({ refresh }) }));

const resposta = (data: unknown, ok = true) => new Response(JSON.stringify({ success: ok, data }), { status: ok ? 200 : 500, headers: { "content-type": "application/json" } });
const mapa = { id: "deteccao-1", proposedRowLabel: "A", proposedSeatNumber: "1", proposedX: 1, proposedY: 1 };
const substituicao = { inheritedSessionIds: ["sessao-1"], inventorySessionIds: ["sessao-1"], inventoryCreatedCount: 2, previousMapArchive: { archived: true, code: "ARCHIVED" as const } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("MapaPage substituição segura", () => {
  beforeEach(() => { vi.restoreAllMocks(); refresh.mockReset(); });

  it("confirma uma vez, preserva CONFIRMADO e oferece retry com mapId fixo", async () => {
    const chamadas: { url: string; init?: RequestInit }[] = [];
    let substituicoes = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); chamadas.push({ url, init });
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-confirmado" });
      if (url.endsWith("/mapas/mapa-confirmado/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      if (url.endsWith("/mapas/mapa-confirmado/confirmar")) return resposta({});
      if (url.endsWith("/mapa-padrao/substituir")) { substituicoes++; return resposta(substituicao); }
      throw new Error(`URL inesperada: ${url}`);
    }));
    render(React.createElement(MapaPage));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", false));
    fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mapa" }));
    await waitFor(() => expect(screen.getByText(/versão anterior arquivada/i)).toBeTruthy());
    expect(substituicoes).toBe(1);
    expect(screen.getAllByRole("status").some(element => element.textContent === "Mapa confirmado")).toBe(true);
    const confirma = chamadas.find(x => x.url.endsWith("/mapa-padrao/substituir"));
    expect(JSON.parse(String(confirma?.init?.body))).toEqual({ mapId: "mapa-confirmado" });
  });

  it("mantém o mapId confirmado no retry e não faz novo upload", async () => {
    const chamadas: { url: string; init?: RequestInit }[] = [];
    let tentativas = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); chamadas.push({ url, init });
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-confirmado" });
      if (url.endsWith("/mapas/mapa-confirmado/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      if (url.endsWith("/mapas/mapa-confirmado/confirmar")) return resposta({});
      if (url.endsWith("/mapa-padrao/substituir")) return ++tentativas === 1 ? resposta({}, false) : resposta(substituicao);
      throw new Error(`URL inesperada: ${url}`);
    }));
    render(React.createElement(MapaPage));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", false));
    fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mapa" }));
    const retry = await screen.findByRole("button", { name: "Substituir mapa padrão novamente" });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText(/versão anterior arquivada/i)).toBeTruthy());
    const substituicoes = chamadas.filter(x => x.url.endsWith("/mapa-padrao/substituir"));
    expect(substituicoes).toHaveLength(2);
    expect(substituicoes.map(x => JSON.parse(String(x.init?.body)))).toEqual([{ mapId: "mapa-confirmado" }, { mapId: "mapa-confirmado" }]);
    expect(chamadas.some(x => x.url.endsWith("/mapas/import"))).toBe(false);
  });

  it("atualiza a falha do retry e preserva CONFIRMADO e a pendência", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-confirmado" });
      if (url.endsWith("/mapas/mapa-confirmado/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      if (url.endsWith("/mapas/mapa-confirmado/confirmar")) return resposta({});
      if (url.endsWith("/mapa-padrao/substituir")) return resposta({}, false);
      throw new Error(`URL inesperada: ${url}`);
    }));
    render(React.createElement(MapaPage));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", false));
    fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mapa" }));
    const retry = await screen.findByRole("button", { name: "Substituir mapa padrão novamente" });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/versão confirmada foi preservada/i));
    expect(screen.getAllByRole("status").some(element => element.textContent === "Mapa confirmado")).toBe(true);
    expect(screen.getByRole("button", { name: "Substituir mapa padrão novamente" })).toBeTruthy();
  });

  it("limpa a pendência e os avisos quando começa um novo upload", async () => {
    let tentativas = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-confirmado" });
      if (url.endsWith("/mapas/mapa-confirmado/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      if (url.endsWith("/mapas/mapa-confirmado/confirmar")) return resposta({});
      if (url.endsWith("/mapa-padrao/substituir")) return ++tentativas === 1 ? resposta({}, false) : resposta(substituicao);
      if (url.endsWith("/mapas/import")) return resposta({ mapId: "mapa-novo" });
      if (url.endsWith("/mapas/mapa-novo/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      throw new Error(`URL inesperada: ${url}`);
    }));
    render(React.createElement(MapaPage));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", false));
    fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mapa" }));
    await screen.findByRole("button", { name: "Substituir mapa padrão novamente" });
    const arquivo = new File(["mapa"], "novo.svg", { type: "image/svg+xml" });
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { files: [arquivo] } });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Substituir mapa padrão novamente" })).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sincroniza o mapa atual sem chamar a rota de substituição no carregamento", async () => {
    const chamadas: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input); chamadas.push(url);
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-atual" });
      if (url.endsWith("/mapas/mapa-atual/revisao")) return resposta({ map: { status: "CONFIRMADO" }, detections: [mapa] });
      if (url.endsWith("/mapa-padrao")) return resposta({ inheritedSessionIds: [], inventorySessionIds: [], inventoryCreatedCount: 0 });
      throw new Error(`URL inesperada: ${url}`);
    }));
    render(React.createElement(MapaPage));
    await waitFor(() => expect(screen.getByText("Mapa confirmado")).toBeTruthy());
    expect(chamadas.filter(url => url.endsWith("/mapa-padrao/substituir"))).toHaveLength(0);
    expect(chamadas.filter(url => url.endsWith("/mapa-padrao"))).toHaveLength(1);
  });

  it("recupera no reload a ação de migrar quando o PATCH encontra MAP_IN_USE", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-atual" });
      if (url.endsWith("/mapas/mapa-atual/revisao")) return resposta({ map: { status: "CONFIRMADO" }, detections: [mapa] });
      if (url.endsWith("/mapa-padrao")) return resposta({
        previousMapId: "mapa-anterior",
        inheritedSessionIds: ["sessao-herdada"],
        inventorySessionIds: ["sessao-herdada"],
        inventoryCreatedCount: 0,
        previousMapArchive: { archived: false, code: "MAP_IN_USE" as const, sessionIds: ["sessao-explicita", "sessao-herdada"] },
      });
      if (url.endsWith("/mapas/mapa-anterior/migrar-e-excluir")) return resposta({ oldMapId: "mapa-anterior", targetMapId: "mapa-atual", migratedSessionIds: ["sessao-explicita", "sessao-herdada"], inheritedSessionIds: ["sessao-herdada"], inventoryCreatedCount: 4, deletedMap: { deleted: true, code: "DELETED" as const } });
      throw new Error(`URL inesperada: ${url}`);
    }));
    render(React.createElement(MapaPage));
    const migrate = await screen.findByRole("button", { name: "Migrar sessões e excluir mapa anterior" });
    fireEvent.click(migrate);
    await waitFor(() => expect(screen.getByText(/mapa anterior excluído/i)).toBeTruthy());
    expect(screen.queryByText(/Revise o inventário/)).toBeNull();
  });

  it("remove os avisos de inventário da troca anterior após novo upload", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-confirmado" });
      if (url.endsWith("/mapas/mapa-confirmado/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      if (url.endsWith("/mapas/mapa-confirmado/confirmar")) return resposta({});
      if (url.endsWith("/mapa-padrao/substituir")) return resposta(substituicao);
      if (url.endsWith("/mapas/import")) return resposta({ mapId: "mapa-novo" });
      if (url.endsWith("/mapas/mapa-novo/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      throw new Error(`URL inesperada: ${url}`);
    }));
    render(React.createElement(MapaPage));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", false));
    fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mapa" }));
    await screen.findByText(/Revise o inventário de 1 sessão/);
    const arquivo = new File(["mapa"], "novo.svg", { type: "image/svg+xml" });
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { files: [arquivo] } });
    await waitFor(() => expect(screen.queryByText(/Revise o inventário de 1 sessão/)).toBeNull());
    expect(screen.queryByText(/versão anterior arquivada/i)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("impede confirmação duplicada enquanto a requisição está pendente", async () => {
    let resolver!: (response: Response) => void;
    const pendente = new Promise<Response>(resolve => { resolver = resolve; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-atual" });
      if (url.endsWith("/mapas/mapa-atual/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      if (url.endsWith("/mapas/mapa-atual/confirmar")) return pendente;
      return resposta({ previousMapArchive: { archived: true, code: "ARCHIVED" }, inheritedSessionIds: [], inventorySessionIds: [], inventoryCreatedCount: 0 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(React.createElement(MapaPage));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", false));
    fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
    const button = screen.getByRole("button", { name: "Confirmar mapa" });
    fireEvent.click(button); fireEvent.click(button);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/mapas/mapa-atual/confirmar"))).toHaveLength(1);
    resolver(resposta({}));
  });

  it("consome falha da correção, mantém o alerta e não gera rejeição não tratada", async () => {
    const rejeicoes: unknown[] = [];
    const aoRejeitar = (motivo: unknown) => rejeicoes.push(motivo);
    process.on("unhandledRejection", aoRejeitar);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-atual" });
      if (url.endsWith("/mapas/mapa-atual/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      if (url.endsWith("/mapas/mapa-atual/deteccoes")) return resposta({}, false);
      throw new Error(`URL inesperada: ${url}`);
    }));
    try {
      render(React.createElement(MapaPage));
      await waitFor(() => expect(screen.getByRole("button", { name: "A · 1" })).toBeTruthy());
      fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
      fireEvent.click(screen.getByRole("button", { name: "Corrigir proposta" }));
      await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/falha ao corrigir detecção/i));
      await waitFor(() => expect(screen.getByRole("button", { name: "Corrigir proposta" })).toHaveProperty("disabled", false));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(rejeicoes).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", aoRejeitar);
    }
  });

  it("migra as sessões afetadas e exclui o mapa anterior sem reenviar upload", async () => {
    const chamadas: { url: string; init?: RequestInit }[] = [];
    const substituicaoEmUso = {
      inheritedSessionIds: [],
      inventorySessionIds: [],
      inventoryCreatedCount: 0,
      previousMapId: "mapa-anterior",
      previousMapArchive: { archived: false, code: "MAP_IN_USE" as const, sessionIds: ["sessao-1", "sessao-2"] },
    };
    const migracao = {
      oldMapId: "mapa-anterior",
      targetMapId: "mapa-confirmado",
      migratedSessionIds: ["sessao-1", "sessao-2"],
      inheritedSessionIds: [],
      inventoryCreatedCount: 8,
      deletedMap: { deleted: true, code: "DELETED" as const },
    };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); chamadas.push({ url, init });
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-confirmado" });
      if (url.endsWith("/mapas/mapa-confirmado/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      if (url.endsWith("/mapas/mapa-confirmado/confirmar")) return resposta({});
      if (url.endsWith("/mapa-padrao/substituir")) return resposta(substituicaoEmUso);
      if (url.endsWith("/mapas/mapa-anterior/migrar-e-excluir")) return resposta(migracao);
      throw new Error(`URL inesperada: ${url}`);
    }));
    render(React.createElement(MapaPage));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", false));
    fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mapa" }));
    const migrate = await screen.findByRole("button", { name: "Migrar sessões e excluir mapa anterior" });
    fireEvent.click(migrate);
    await waitFor(() => expect(screen.getByText(/mapa anterior excluído/i)).toBeTruthy());
    const request = chamadas.find(x => x.url.endsWith("/mapas/mapa-anterior/migrar-e-excluir"));
    expect(JSON.parse(String(request?.init?.body))).toEqual({ targetMapId: "mapa-confirmado", sessionIds: ["sessao-1", "sessao-2"] });
    expect(chamadas.some(x => x.url.endsWith("/mapas/import"))).toBe(false);
    expect(screen.getAllByText(/2 sessão/).length).toBeGreaterThan(0);
  });

  it("não chama a migração quando a confirmação é cancelada", async () => {
    let migrationCalls = 0;
    const substituicaoEmUso = { inheritedSessionIds: [], inventorySessionIds: [], inventoryCreatedCount: 0, previousMapId: "mapa-anterior", previousMapArchive: { archived: false, code: "MAP_IN_USE" as const, sessionIds: ["sessao-1"] } };
    vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-confirmado" });
      if (url.endsWith("/mapas/mapa-confirmado/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      if (url.endsWith("/mapas/mapa-confirmado/confirmar")) return resposta({});
      if (url.endsWith("/mapa-padrao/substituir")) return resposta(substituicaoEmUso);
      if (url.endsWith("/migrar-e-excluir")) { migrationCalls += 1; return resposta({}); }
      throw new Error(`URL inesperada: ${url}`);
    }));
    render(React.createElement(MapaPage));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", false));
    fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mapa" }));
    fireEvent.click(await screen.findByRole("button", { name: "Migrar sessões e excluir mapa anterior" }));
    await waitFor(() => expect(screen.getByText(/mapa anterior foi preservado/i)).toBeTruthy());
    expect(migrationCalls).toBe(0);
  });

  it("preserva CONFIRMADO e MAP_IN_USE quando a migração é bloqueada por dependência", async () => {
    const substituicaoEmUso = { inheritedSessionIds: [], inventorySessionIds: [], inventoryCreatedCount: 0, previousMapId: "mapa-anterior", previousMapArchive: { archived: false, code: "MAP_IN_USE" as const, sessionIds: ["sessao-1"] } };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/eventos/admin/evento-1")) return resposta({ defaultMapId: "mapa-confirmado" });
      if (url.endsWith("/mapas/mapa-confirmado/revisao")) return resposta({ map: { status: "EM_REVISAO" }, detections: [mapa] });
      if (url.endsWith("/mapas/mapa-confirmado/confirmar")) return resposta({});
      if (url.endsWith("/mapa-padrao/substituir")) return resposta(substituicaoEmUso);
      if (url.endsWith("/migrar-e-excluir")) return new Response(JSON.stringify({ success: false, error: { code: "SESSION_HAS_DEPENDENCIES", message: "A sessão possui dependências" } }), { status: 409, headers: { "content-type": "application/json" } });
      throw new Error(`URL inesperada: ${url}`);
    }));
    render(React.createElement(MapaPage));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", false));
    fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mapa" }));
    const migrate = await screen.findByRole("button", { name: "Migrar sessões e excluir mapa anterior" });
    fireEvent.click(migrate);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/SESSION_HAS_DEPENDENCIES/));
    expect(screen.getByText(/mapa anterior foi preservado/i)).toBeTruthy();
    expect(screen.getAllByRole("status").some(element => element.textContent === "Mapa confirmado")).toBe(true);
    expect(screen.getByRole("button", { name: "Migrar sessões e excluir mapa anterior" })).toBeTruthy();
  });
});
