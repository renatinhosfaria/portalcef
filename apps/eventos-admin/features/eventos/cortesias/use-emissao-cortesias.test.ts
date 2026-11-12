// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MapaAdminSessao } from "@essencia/shared/types";
import { useEmissaoCortesias } from "./use-emissao-cortesias";
import { emitirCortesias } from "./api-cortesias";

vi.mock("./api-cortesias", async (importOriginal) => ({ ...(await importOriginal<typeof import("./api-cortesias")>()), emitirCortesias: vi.fn() }));

const mapa: MapaAdminSessao = {
  sessionId: "sessao-1",
  mapId: "mapa-1",
  seats: [
    { id: "seat-1", sessionId: "sessao-1", rowLabel: "A", seatNumber: "1", x: 0, y: 0, width: 10, height: 10, category: null, accessible: false, state: "available" },
    { id: "seat-2", sessionId: "sessao-1", rowLabel: "B", seatNumber: "4", x: 0, y: 0, width: 10, height: 10, category: null, accessible: false, state: "available" },
  ],
  inventarioPorAssento: { "seat-1": "inv-1", "seat-2": "inv-2" },
};

const criar = (overrides: Partial<Parameters<typeof useEmissaoCortesias>[0]> = {}) => {
  const gerarChave = vi.fn(() => `chave-${gerarChave.mock.calls.length + 1}`);
  const aoEmitir = vi.fn();
  const hook = renderHook((props: Parameters<typeof useEmissaoCortesias>[0]) => useEmissaoCortesias(props), { initialProps: { eventId: "ev-1", sessionId: "sessao-1", mapa, aoEmitir, gerarChave, ...overrides } });
  return { ...hook, gerarChave, aoEmitir };
};

describe("useEmissaoCortesias", () => {
  it("alterna a seleção e remove o nome junto com o assento", () => {
    const { result } = criar();
    act(() => result.current.alternar("seat-1"));
    act(() => result.current.definirNome("seat-1", "Maria"));
    expect(result.current.selecionados).toEqual(["seat-1"]);
    expect(result.current.nomes).toEqual({ "seat-1": "Maria" });
    act(() => result.current.alternar("seat-1"));
    expect(result.current.selecionados).toEqual([]);
    expect(result.current.nomes).toEqual({});
  });

  it("ignora o 51º assento e sinaliza o limite", () => {
    const seats = Array.from({ length: 51 }, (_, i) => ({ id: `seat-${i}`, sessionId: "sessao-1", rowLabel: "A", seatNumber: String(i), x: 0, y: 0, width: 10, height: 10, category: null, accessible: false, state: "available" as const }));
    const { result } = criar({ mapa: { ...mapa, seats, inventarioPorAssento: Object.fromEntries(seats.map((s) => [s.id, `inv-${s.id}`])) } });
    act(() => { for (let i = 0; i < 51; i += 1) result.current.alternar(`seat-${i}`); });
    expect(result.current.selecionados).toHaveLength(50);
    expect(result.current.limiteAtingido).toBe(true);
  });

  it("só permite emitir com assento, grupo e motivo válidos", () => {
    const { result } = criar();
    expect(result.current.podeEmitir).toBe(false);
    act(() => result.current.alternar("seat-1"));
    act(() => result.current.definirCampo("grupo", " A "));
    act(() => result.current.definirCampo("motivo", "abc"));
    expect(result.current.podeEmitir).toBe(false);
    act(() => result.current.definirCampo("grupo", "Pais"));
    expect(result.current.podeEmitir).toBe(true);
  });

  it("envia inventorySeatId e omite nome vazio", async () => {
    vi.mocked(emitirCortesias).mockResolvedValue([]);
    const { result } = criar();
    act(() => { result.current.alternar("seat-1"); result.current.alternar("seat-2"); });
    act(() => { result.current.definirCampo("grupo", "Pais"); result.current.definirCampo("motivo", "Convidados"); result.current.definirNome("seat-1", "Maria"); result.current.definirNome("seat-2", " "); });
    await act(async () => { await result.current.emitir(); });
    expect(emitirCortesias).toHaveBeenCalledWith("ev-1", expect.objectContaining({ assentos: [{ inventorySeatId: "inv-1", nome: "Maria" }, { inventorySeatId: "inv-2" }] }));
  });

  it("no sucesso limpa a seleção, renova a chave e avisa", async () => {
    const emitidas = [{ orderId: "pedido-1" }];
    vi.mocked(emitirCortesias).mockResolvedValue(emitidas as never);
    const { result, gerarChave, aoEmitir } = criar();
    act(() => { result.current.alternar("seat-1"); result.current.definirCampo("grupo", "Pais"); result.current.definirCampo("motivo", "Convidados"); });
    await act(async () => { await result.current.emitir(); });
    expect(gerarChave).toHaveBeenCalledTimes(2);
    expect(result.current.selecionados).toEqual([]);
    expect(aoEmitir).toHaveBeenCalledWith(emitidas);
  });

  it("no conflito mantém seleção e chave e marca os assentos", async () => {
    const erro = Object.assign(new Error("ocupados"), { code: "ASSENTOS_INDISPONIVEIS", details: { conflitos: [{ inventorySeatId: "inv-2", rowLabel: "B", seatNumber: "4", motivo: "VENDIDO" }] } });
    vi.mocked(emitirCortesias).mockRejectedValue(erro);
    const { result, gerarChave } = criar();
    act(() => { result.current.alternar("seat-2"); result.current.definirCampo("grupo", "Pais"); result.current.definirCampo("motivo", "Convidados"); });
    await act(async () => { await result.current.emitir(); });
    expect(result.current.selecionados).toEqual(["seat-2"]);
    expect(result.current.conflitos).toEqual(new Set(["seat-2"]));
    expect(result.current.erro).toBe("Estes lugares não estão mais livres: Fileira B · Assento 4. Troque-os e tente de novo.");
    expect(gerarChave).toHaveBeenCalledTimes(1);
  });

  it("trocar de sessão limpa a seleção e mantém o grupo", () => {
    const { result, rerender, gerarChave } = criar();
    act(() => { result.current.alternar("seat-1"); result.current.definirCampo("grupo", "Pais"); });
    rerender({ eventId: "ev-1", sessionId: "sessao-2", mapa: { ...mapa, sessionId: "sessao-2" }, aoEmitir: vi.fn(), gerarChave });
    expect(result.current.selecionados).toEqual([]);
    expect(result.current.nomes).toEqual({});
    expect(result.current.grupo).toBe("Pais");
  });
});
