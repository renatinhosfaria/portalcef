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

const aluna = (nome: string, total: number, ingressos: ConvidadosPorAluna["alunas"][number]["ingressos"] = []): ConvidadosPorAluna["alunas"][number] => ({ chave: nome.toLowerCase(), nome, total, grafias: [{ chave: nome.toLowerCase(), nome, total, juntada: false }], ingressos });
const variasAlunas: ConvidadosPorAluna = {
  totalPagantes: 9,
  semAluna: 0,
  alunas: [
    aluna("Carla Lima", 4),
    aluna("Beatriz Oliveira Santos", 2),
    aluna("Bia", 2),
    aluna("Beatriz O. Santos", 1, [{ numero: "ING7", participantName: "João Souza", studentName: "Beatriz O. Santos", buyerName: "Marta Souza", orderNumber: "PED7", rowLabel: "A", seatNumber: "7", sessionStartsAt: new Date("2026-12-07T19:00:00Z") }]),
  ],
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

  it("junta as alunas marcadas no nome escolhido como principal", async () => {
    vi.mocked(listarAlunas).mockResolvedValue(variasAlunas);
    render(<PainelAlunas eventId="ev-1" />);
    await waitFor(() => expect(screen.queryByText("Carregando contagem…")).toBeNull());
    expect(screen.queryByRole("button", { name: /Juntar/ })).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Beatriz Oliveira Santos" }));
    expect(screen.queryByRole("button", { name: /Juntar/ })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Beatriz O. Santos" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Bia" }));

    // Por padrão o nome principal é o da aluna marcada com mais convidados.
    expect((screen.getByRole("radio", { name: "Beatriz Oliveira Santos" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Beatriz O. Santos" }));
    fireEvent.click(screen.getByRole("button", { name: "Juntar 3 nomes" }));

    await waitFor(() => expect(juntarAlunas).toHaveBeenCalledWith("ev-1", { destino: "beatriz o. santos", origens: ["beatriz oliveira santos", "bia"] }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Juntar/ })).toBeNull());
  });

  it("desmarcar o nome principal volta ao padrão e limpar desfaz a seleção", async () => {
    vi.mocked(listarAlunas).mockResolvedValue(variasAlunas);
    render(<PainelAlunas eventId="ev-1" />);
    await waitFor(() => expect(screen.queryByText("Carregando contagem…")).toBeNull());
    for (const nome of ["Beatriz Oliveira Santos", "Beatriz O. Santos", "Bia"]) fireEvent.click(screen.getByRole("checkbox", { name: `Selecionar ${nome}` }));
    fireEvent.click(screen.getByRole("radio", { name: "Bia" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Bia" }));
    expect((screen.getByRole("radio", { name: "Beatriz Oliveira Santos" }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(screen.queryByRole("button", { name: /Juntar/ })).toBeNull();
    expect((screen.getByRole("checkbox", { name: "Selecionar Beatriz O. Santos" }) as HTMLInputElement).checked).toBe(false);
  });

  it("ordena por convidados ou por nome, para achar grafias parecidas", async () => {
    vi.mocked(listarAlunas).mockResolvedValue(variasAlunas);
    render(<PainelAlunas eventId="ev-1" />);
    await waitFor(() => expect(screen.queryByText("Carregando contagem…")).toBeNull());
    const nomes = () => screen.getAllByRole("heading", { level: 3 }).map((titulo) => titulo.textContent);
    expect(nomes()).toEqual(["Carla Lima", "Beatriz Oliveira Santos", "Bia", "Beatriz O. Santos"]);

    fireEvent.change(screen.getByLabelText("Ordenar por"), { target: { value: "nome" } });
    expect(nomes()).toEqual(["Beatriz O. Santos", "Beatriz Oliveira Santos", "Bia", "Carla Lima"]);
  });

  it("mostra comprador e pedido de cada ingresso para conferência", async () => {
    vi.mocked(listarAlunas).mockResolvedValue(variasAlunas);
    render(<PainelAlunas eventId="ev-1" />);
    await waitFor(() => expect(screen.queryByText("Carregando contagem…")).toBeNull());
    expect(screen.getByText("ING7 · João Souza · lugar A7 · comprado por Marta Souza · pedido PED7")).toBeTruthy();
  });

  it("separa uma grafia juntada", async () => {
    render(<PainelAlunas eventId="ev-1" />);
    await waitFor(() => expect(screen.queryByText("Carregando contagem…")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Separar Bia" }));
    await waitFor(() => expect(separarAluna).toHaveBeenCalledWith("ev-1", "bia"));
  });

  it("mostra erro quando a contagem não carrega", async () => {
    vi.mocked(listarAlunas).mockRejectedValue(new Error("falha"));
    render(<PainelAlunas eventId="ev-1" />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Não foi possível carregar a contagem de alunas convidadas."));
  });
});
