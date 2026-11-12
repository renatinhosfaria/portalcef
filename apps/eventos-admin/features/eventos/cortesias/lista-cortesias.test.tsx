// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CortesiaResumo } from "@essencia/shared/types";
import { ListaCortesias } from "./lista-cortesias";

afterEach(() => cleanup());

const criar = (parcial: Partial<CortesiaResumo> = {}): CortesiaResumo => ({ orderId: "pedido-1", orderNumber: "ORD-1", session: { id: "sessao-1", startsAt: new Date("2026-12-12T20:00:00Z") }, rowLabel: "A", seatNumber: "1", participantName: "José Silva", grupo: "Professores", motivo: "Convidados", numero: "00000001", situacao: "ATIVA", emitidaPor: "Diretora", emitidaEm: new Date("2026-11-12T10:00:00Z"), canceladaEm: null, ...parcial });

describe("ListaCortesias", () => {
  it("mostra colunas, busca sem acentos e filtra por sessão", () => {
    const outra = criar({ orderId: "pedido-2", session: { id: "sessao-2", startsAt: new Date("2026-12-13T20:00:00Z") }, participantName: "Maria Souza", grupo: "Convidados" });
    render(<ListaCortesias cortesias={[criar(), outra]} sessoes={[{ id: "sessao-1", startsAt: "2026-12-12T20:00:00Z", apta: true }, { id: "sessao-2", startsAt: "2026-12-13T20:00:00Z", apta: true }]} aoBaixar={vi.fn()} aoCancelar={vi.fn()} />);
    expect(screen.getByText("José Silva")).not.toBeNull();
    expect(screen.getByText("Professores")).not.toBeNull();
    expect(screen.getByText("Número do ingresso")).not.toBeNull();
    expect(screen.getByText("Emitida por")).not.toBeNull();
    const cabecalhos = screen.getAllByRole("columnheader").map((c) => c.textContent);
    expect(cabecalhos).toEqual(["Sessão", "Assento", "Nome", "Grupo", "Número do ingresso", "Emitida por", "Data", "Situação", "Ações"]);
    expect(screen.getAllByText("0000-0001")).not.toBeNull();
    expect(screen.getAllByText("Diretora")).not.toBeNull();
    expect(screen.getAllByText("12/11/2026 07:00").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Buscar cortesias"), { target: { value: "jose" } });
    expect(screen.getByText("José Silva")).not.toBeNull();
    expect(screen.queryByText("Maria Souza")).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar cortesias"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filtrar por sessão"), { target: { value: "sessao-2" } });
    expect(screen.getByText("Maria Souza")).not.toBeNull();
    expect(screen.queryByText("José Silva")).toBeNull();
  });

  it("desabilita ações conforme a situação e mostra estados vazios", () => {
    const usada = criar({ orderId: "pedido-2", orderNumber: "ORD-2", situacao: "USADA", participantName: "Usada" });
    const cancelada = criar({ orderId: "pedido-3", orderNumber: "ORD-3", situacao: "CANCELADA", participantName: "Cancelada" });
    render(<ListaCortesias cortesias={[criar(), usada, cancelada]} sessoes={[]} aoBaixar={vi.fn()} aoCancelar={vi.fn()} />);
    expect((screen.getByRole("button", { name: /Baixar PDF.*ORD-1/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /Cancelar.*Usada/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Baixar PDF.*ORD-3/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Buscar cortesias"), { target: { value: "inexistente" } });
    expect(screen.getByText("Nenhuma cortesia encontrada.")).not.toBeNull();
  });

  it("não mantém motivo nem erro do diálogo ao trocar de cortesia", async () => {
    const outra = criar({ orderId: "pedido-2", orderNumber: "ORD-2", participantName: "Maria Souza" });
    const aoCancelar = vi.fn().mockRejectedValue(new Error("falha"));
    render(<ListaCortesias cortesias={[criar(), outra]} sessoes={[]} aoBaixar={vi.fn()} aoCancelar={aoCancelar} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar José Silva" }));
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "erro de digitação" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar cortesia" }));
    await waitFor(() => expect(screen.getByRole("alert")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar Maria Souza" }));
    expect((screen.getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("baixa o PDF com estado por linha", async () => {
    let concluir: () => void = () => undefined;
    const aoBaixar = vi.fn(() => new Promise<void>((resolve) => { concluir = resolve; }));
    const outra = criar({ orderId: "pedido-2", orderNumber: "ORD-2", participantName: "Maria Souza" });
    render(<ListaCortesias cortesias={[criar(), outra]} sessoes={[]} aoBaixar={aoBaixar} aoCancelar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Baixar PDF.*ORD-1/ }));
    const gerando = await screen.findByRole("button", { name: /Baixar PDF.*ORD-1/ });
    expect(gerando.textContent).toBe("Gerando PDF…");
    expect((gerando as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Baixar PDF.*ORD-2/ }) as HTMLButtonElement).disabled).toBe(false);
    concluir();
    await waitFor(() => expect(screen.getByRole("button", { name: /Baixar PDF.*ORD-1/ }).textContent).toBe("Baixar PDF"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mostra alerta quando a geração do PDF falha", async () => {
    const aoBaixar = vi.fn().mockRejectedValue(new Error("falha"));
    render(<ListaCortesias cortesias={[criar()]} sessoes={[]} aoBaixar={aoBaixar} aoCancelar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Baixar PDF.*ORD-1/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Não foi possível gerar o PDF."));
    expect(screen.getByRole("button", { name: /Baixar PDF.*ORD-1/ }).textContent).toBe("Baixar PDF");
  });

  it("mostra mensagem quando não há cortesias", () => {
    render(<ListaCortesias cortesias={[]} sessoes={[]} aoBaixar={vi.fn()} aoCancelar={vi.fn()} />);
    expect(screen.getByText("Nenhuma cortesia emitida neste evento")).not.toBeNull();
  });
});
