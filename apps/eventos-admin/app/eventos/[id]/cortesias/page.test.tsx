// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CortesiasPage from "./page";
import { cancelarCortesia, listarCortesias, obterMapaAdmin } from "../../../../features/eventos/cortesias/api-cortesias";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "ev-1" }) }));
vi.mock("../../../../features/eventos/cortesias/api-cortesias", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../../features/eventos/cortesias/api-cortesias")>()), listarCortesias: vi.fn(), cancelarCortesia: vi.fn(), obterMapaAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("../../../../features/eventos/cortesias/baixar-voucher", () => ({ baixarVoucher: vi.fn() }));

const AVISO_SEM_SESSAO = "Este evento ainda não tem sessão com mapa confirmado.";
const AVISO_SEM_CORTESIA = "Nenhuma cortesia emitida neste evento";

beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("aba de cortesias", () => {
  it("durante o carregamento não mostra avisos de vazio", async () => {
    vi.mocked(listarCortesias).mockReturnValue(new Promise(() => undefined));
    render(<CortesiasPage />);
    expect(screen.getByText("Carregando cortesias…")).not.toBeNull();
    expect(screen.queryByText(AVISO_SEM_SESSAO)).toBeNull();
    expect(screen.queryByText(AVISO_SEM_CORTESIA)).toBeNull();
  });

  it("depois da carga mostra a emissão e a lista", async () => {
    vi.mocked(listarCortesias).mockResolvedValue([]);
    render(<CortesiasPage />);
    await waitFor(() => expect(screen.queryByText("Carregando cortesias…")).toBeNull());
    expect(screen.getByText(AVISO_SEM_SESSAO)).not.toBeNull();
    expect(screen.getByText(AVISO_SEM_CORTESIA)).not.toBeNull();
  });

  it("erro de carga mostra alerta e não os avisos de vazio", async () => {
    vi.mocked(listarCortesias).mockRejectedValue(new Error("falha"));
    render(<CortesiasPage />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Não foi possível carregar as cortesias."));
    expect(screen.queryByText("Carregando cortesias…")).toBeNull();
    expect(screen.queryByText(AVISO_SEM_CORTESIA)).toBeNull();
  });

  it("sessão CANCELADA com mapa não fica apta para emitir", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [
      { id: "sessao-cancelada", startsAt: "2026-12-12T20:00:00Z", mapId: "mapa-1", status: "CANCELADA" },
      { id: "sessao-ativa", startsAt: "2026-12-13T20:00:00Z", mapId: "mapa-1", status: "PUBLICADA" },
    ] }) }));
    vi.mocked(listarCortesias).mockResolvedValue([]);
    const { container } = render(<CortesiasPage />);
    await waitFor(() => expect(screen.queryByText("Carregando cortesias…")).toBeNull());
    expect((container.querySelector('option[value="sessao-cancelada"]') as HTMLOptionElement).disabled).toBe(true);
    expect((container.querySelector('option[value="sessao-ativa"]') as HTMLOptionElement).disabled).toBe(false);
    await waitFor(() => expect(obterMapaAdmin).toHaveBeenCalledWith("ev-1", "sessao-ativa"));
    expect(obterMapaAdmin).not.toHaveBeenCalledWith("ev-1", "sessao-cancelada");
  });

  it("recarrega o mapa da sessão selecionada depois de cancelar uma cortesia", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: "sessao-1", startsAt: "2026-12-12T20:00:00Z", mapId: "mapa-1", status: "PUBLICADA" }] }) }));
    const cortesia = { orderId: "pedido-1", orderNumber: "EVT-1", session: { id: "sessao-1", startsAt: new Date("2026-12-12T20:00:00Z") }, rowLabel: "A", seatNumber: "1", participantName: "Maria", grupo: "Pais", motivo: "Convidados", numero: "ABCD1234", situacao: "ATIVA" as const, emitidaPor: "Secretaria", emitidaEm: new Date("2026-11-12T10:00:00Z"), canceladaEm: null };
    vi.mocked(listarCortesias).mockResolvedValue([cortesia]);
    vi.mocked(cancelarCortesia).mockResolvedValue({ ...cortesia, situacao: "CANCELADA" } as never);
    render(<CortesiasPage />);
    await waitFor(() => expect(obterMapaAdmin).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar Maria" }));
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Desistência" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar cortesia" }));
    await waitFor(() => expect(cancelarCortesia).toHaveBeenCalledWith("ev-1", "pedido-1", "Desistência"));
    await waitFor(() => expect(obterMapaAdmin).toHaveBeenCalledTimes(2));
    expect(obterMapaAdmin).toHaveBeenLastCalledWith("ev-1", "sessao-1");
  });
});
