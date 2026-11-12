// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CortesiasPage from "./page";
import { listarCortesias } from "../../../../features/eventos/cortesias/api-cortesias";

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
});
