// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EstadoEmissao } from "./use-emissao-cortesias";
import { PainelLote } from "./painel-lote";

const estado = (parcial: Partial<EstadoEmissao> = {}): EstadoEmissao => ({
  selecionados: ["seat-1"], nomes: { "seat-1": "" }, grupo: "Pais", motivo: "Convidados", contatoEmail: "", contatoTelefone: "", conflitos: new Set(), enviando: false, erro: null, limiteAtingido: false, podeEmitir: true, ...parcial,
});

afterEach(() => cleanup());

describe("PainelLote", () => {
  it("lista os rótulos, controla nomes e pluraliza o botão", () => {
    const aoDefinirNome = vi.fn();
    const aoDefinirCampo = vi.fn();
    const aoEmitir = vi.fn();
    const { rerender } = render(<PainelLote assentos={[{ seatId: "seat-1", rotulo: "Fileira A · Assento 1", nome: "", conflito: false }]} estado={estado()} aoRemover={vi.fn()} aoDefinirNome={aoDefinirNome} aoDefinirCampo={aoDefinirCampo} aoEmitir={aoEmitir} />);
    expect(screen.getByText("Fileira A · Assento 1")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Nome para Fileira A · Assento 1"), { target: { value: "Maria" } });
    expect(aoDefinirNome).toHaveBeenCalledWith("seat-1", "Maria");
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "Professores" } });
    expect(aoDefinirCampo).toHaveBeenCalledWith("grupo", "Professores");
    rerender(<PainelLote assentos={[{ seatId: "seat-1", rotulo: "Fileira A · Assento 1", nome: "", conflito: false }, { seatId: "seat-2", rotulo: "Fileira B · Assento 4", nome: "", conflito: false }]} estado={estado({ selecionados: ["seat-1", "seat-2"] })} aoRemover={vi.fn()} aoDefinirNome={aoDefinirNome} aoDefinirCampo={aoDefinirCampo} aoEmitir={aoEmitir} />);
    expect(screen.getByRole("button", { name: "Emitir 2 cortesias" })).not.toBeNull();
  });

  it("desabilita emissão sem grupo ou motivo e mostra limite e conflito", () => {
    const props = { assentos: [{ seatId: "seat-1", rotulo: "Fileira A · Assento 1", nome: "", conflito: true }], estado: estado({ selecionados: [], grupo: "", motivo: "", podeEmitir: false, limiteAtingido: true }), aoRemover: vi.fn(), aoDefinirNome: vi.fn(), aoDefinirCampo: vi.fn(), aoEmitir: vi.fn() };
    render(<PainelLote {...props} />);
    expect((screen.getByRole("button", { name: "Emitir cortesias" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Limite de 50 assentos por emissão.")).not.toBeNull();
    expect(screen.getByLabelText("Nome para Fileira A · Assento 1").getAttribute("aria-invalid")).toBe("true");
  });
});
