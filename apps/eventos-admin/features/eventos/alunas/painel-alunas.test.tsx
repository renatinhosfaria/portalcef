// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConvidadosPorAluna } from "@essencia/shared/types";
import { juntarAlunas, listarAlunas, separarAluna } from "./api-alunas";
import { PainelAlunas } from "./painel-alunas";

vi.mock("./api-alunas", () => ({ listarAlunas: vi.fn(), juntarAlunas: vi.fn(), separarAluna: vi.fn() }));

const dados: ConvidadosPorAluna = {
  totalPagantes: 4,
  semAluna: 1,
  alunas: [{ chave: "beatriz santos", nome: "Beatriz Santos", total: 3, grafias: [
    { chave: "beatriz santos", nome: "Beatriz Santos", total: 2, juntada: false },
    { chave: "bia", nome: "Bia", total: 1, juntada: true },
  ], ingressos: [] }],
};

beforeEach(() => { vi.mocked(listarAlunas).mockResolvedValue(dados); vi.mocked(juntarAlunas).mockResolvedValue(dados); vi.mocked(separarAluna).mockResolvedValue(dados); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("PainelAlunas", () => {
  it("mostra contagem, grafias e ingressos sem aluna", async () => {
    render(<PainelAlunas eventId="ev-1" />);
    await waitFor(() => expect(screen.queryByText("Carregando contagem…")).toBeNull());
    expect(screen.getByText("Beatriz Santos")).toBeTruthy();
    expect(screen.getByText("3 convidados pagantes")).toBeTruthy();
    expect(screen.getByText(/1 ingresso sem aluna informada/)).toBeTruthy();
    expect(screen.getByText(/Bia · 1 ingresso/)).toBeTruthy();
  });

  it("junta nomes informados e separa uma grafia", async () => {
    render(<PainelAlunas eventId="ev-1" />);
    await waitFor(() => expect(screen.queryByText("Carregando contagem…")).toBeNull());
    fireEvent.change(screen.getByLabelText("Nome principal"), { target: { value: "Beatriz Santos" } });
    fireEvent.change(screen.getByLabelText("Outras grafias"), { target: { value: "Bia, Bea" } });
    fireEvent.click(screen.getByRole("button", { name: "Juntar nomes" }));
    await waitFor(() => expect(juntarAlunas).toHaveBeenCalledWith("ev-1", { destino: "Beatriz Santos", origens: ["Bia", "Bea"] }));

    fireEvent.click(screen.getByRole("button", { name: "Separar Bia" }));
    await waitFor(() => expect(separarAluna).toHaveBeenCalledWith("ev-1", "bia"));
  });

  it("mostra erro quando a contagem não carrega", async () => {
    vi.mocked(listarAlunas).mockRejectedValue(new Error("falha"));
    render(<PainelAlunas eventId="ev-1" />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Não foi possível carregar a contagem de alunas convidadas."));
  });
});
