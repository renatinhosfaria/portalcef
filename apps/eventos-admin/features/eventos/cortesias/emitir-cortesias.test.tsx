// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapaAdminSessao } from "@essencia/shared/types";
import { EmitirCortesias } from "./emitir-cortesias";
import { emitirCortesias, obterMapaAdmin } from "./api-cortesias";

vi.mock("./api-cortesias", async (importOriginal) => ({ ...(await importOriginal<typeof import("./api-cortesias")>()), emitirCortesias: vi.fn(), obterMapaAdmin: vi.fn() }));
vi.mock("@essencia/components/eventos/adaptar-mapa", () => ({ paraLugaresPublicos: (mapa: MapaAdminSessao) => mapa.seats.map((seat) => ({ id: seat.id, fileira: seat.rowLabel, numero: seat.seatNumber, x: seat.x, y: seat.y, largura: seat.width, altura: seat.height, rotacao: seat.rotacao ?? 0, categoria: null, acessoExterno: false, estado: "livre", livre: seat.state === "available", acessivel: false, rotuloCurto: `${seat.rowLabel}${seat.seatNumber}` })), rotulosDoMapa: () => [], dimensoesDoMapa: () => ({ largura: 100, altura: 100 }), elementosDoMapa: () => [] }));
vi.mock("@essencia/components/eventos/mapa-estilo-b", () => ({ MapaEstiloB: ({ lugares, onLugarClick }: { lugares: Array<{ id: string; fileira: string; numero: string }>; onLugarClick?: (id: string, evento: { shiftKey: boolean }) => void }) => <div data-testid="mapa">{lugares.map((lugar) => <button type="button" key={lugar.id} aria-label={`assento ${lugar.fileira}${lugar.numero}`} onClick={() => onLugarClick?.(lugar.id, { shiftKey: false })}>{lugar.fileira}{lugar.numero}</button>)}</div> }));

const mapa: MapaAdminSessao = { sessionId: "sessao-1", mapId: "mapa-1", seats: [{ id: "seat-1", sessionId: "sessao-1", rowLabel: "A", seatNumber: "1", x: 0, y: 0, width: 10, height: 10, category: null, accessible: false, state: "available" }], inventarioPorAssento: { "seat-1": "inv-1" } };
const sessoes = [{ id: "sessao-1", startsAt: "2026-12-12T20:00:00Z", apta: true }, { id: "sessao-2", startsAt: "2026-12-13T20:00:00Z", apta: false }];

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("EmitirCortesias", () => {
  it("informa quando não há sessão apta e não mostra emissão", () => {
    render(<EmitirCortesias eventId="ev-1" sessoes={[]} aoEmitir={vi.fn()} />);
    expect(screen.getByText("Este evento ainda não tem sessão com mapa confirmado.")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Emitir cortesias/ })).toBeNull();
  });

  it("desabilita sessão sem mapa confirmado e carrega a primeira apta", async () => {
    vi.mocked(obterMapaAdmin).mockResolvedValue(mapa);
    render(<EmitirCortesias eventId="ev-1" sessoes={sessoes} aoEmitir={vi.fn()} />);
    expect((screen.getByRole("option", { name: /Confirme o mapa/ }) as HTMLOptionElement).disabled).toBe(true);
    await waitFor(() => expect(obterMapaAdmin).toHaveBeenCalledWith("ev-1", "sessao-1"));
    expect(screen.getByTestId("mapa")).not.toBeNull();
  });

  it("confirma antes de emitir, avisa o sucesso e recarrega o mapa", async () => {
    vi.mocked(obterMapaAdmin).mockResolvedValue(mapa);
    const emitidas = [{ orderId: "pedido-1" }];
    vi.mocked(emitirCortesias).mockResolvedValue(emitidas as never);
    const aoEmitir = vi.fn();
    render(<EmitirCortesias eventId="ev-1" sessoes={sessoes} aoEmitir={aoEmitir} />);
    await waitFor(() => expect(screen.getByTestId("mapa")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "assento A1" }));
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "Pais" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Convidados" } });
    fireEvent.click(screen.getByRole("button", { name: "Emitir 1 cortesia" }));
    expect(screen.getByRole("dialog").textContent).toContain("Emitir cortesias?");
    expect(emitirCortesias).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button").find((botao) => botao.textContent === "Emitir")!);
    await waitFor(() => expect(emitirCortesias).toHaveBeenCalled());
    expect(aoEmitir).toHaveBeenCalledWith(emitidas);
    expect(obterMapaAdmin).toHaveBeenCalledTimes(2);
  });

  it("mostra os assentos em conflito e recarrega o mapa", async () => {
    vi.mocked(obterMapaAdmin).mockResolvedValue(mapa);
    vi.mocked(emitirCortesias).mockRejectedValue({ code: "ASSENTOS_INDISPONIVEIS", details: { conflitos: [{ inventorySeatId: "inv-1", rowLabel: "A", seatNumber: "1", motivo: "VENDIDO" }] } });
    render(<EmitirCortesias eventId="ev-1" sessoes={sessoes} aoEmitir={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("mapa")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "assento A1" }));
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "Pais" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Convidados" } });
    fireEvent.click(screen.getByRole("button", { name: "Emitir 1 cortesia" }));
    fireEvent.click(screen.getAllByRole("button").find((botao) => botao.textContent === "Emitir")!);
    await waitFor(() => expect(screen.getByText(/Estes lugares não estão mais livres/)).not.toBeNull());
    expect(obterMapaAdmin).toHaveBeenCalledTimes(2);
  });
});
