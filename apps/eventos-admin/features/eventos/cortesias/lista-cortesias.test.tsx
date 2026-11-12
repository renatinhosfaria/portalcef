// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("mostra mensagem quando não há cortesias", () => {
    render(<ListaCortesias cortesias={[]} sessoes={[]} aoBaixar={vi.fn()} aoCancelar={vi.fn()} />);
    expect(screen.getByText("Nenhuma cortesia emitida neste evento")).not.toBeNull();
  });
});
