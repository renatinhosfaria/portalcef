// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapReview, type MapProposal } from "./map-review";

const proposal: MapProposal = { rowLabel: "A", seatNumber: "1", x: 1, y: 1 };
afterEach(() => cleanup());

describe("MapReview", () => {
  it("bloqueia confirmação com conflito ou sem assentos", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(React.createElement(MapReview, { proposals: [{ ...proposal, conflict: "conflito" }], onConfirm }));
    expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", true);
    rerender(React.createElement(MapReview, { proposals: [], onConfirm }));
    expect(screen.getByRole("button", { name: "Confirmar mapa" })).toHaveProperty("disabled", true);
  });

  it("exibe ARCHIVED e MAP_IN_USE com as sessões", () => {
    const { rerender } = render(React.createElement(MapReview, { proposals: [], previousMapArchive: { archived: true, code: "ARCHIVED" } }));
    expect(screen.getByText(/versão anterior arquivada/i));
    rerender(React.createElement(MapReview, { proposals: [], previousMapArchive: { archived: false, code: "MAP_IN_USE", sessionIds: ["sessao-1"] } }));
    expect(screen.getByText(/preservado/i)).toHaveProperty("textContent", expect.stringContaining("sessao-1"));
  });

  it("exige motivo e emite payload estruturado para correção", async () => {
    const onCorrection = vi.fn().mockResolvedValue(undefined);
    render(React.createElement(MapReview, { proposals: [proposal], onCorrection }));
    const button = screen.getByRole("button", { name: "Corrigir proposta" });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByPlaceholderText("Motivo da correção"), { target: { value: "ajuste" } });
    fireEvent.click(button);
    await waitFor(() => expect(onCorrection).toHaveBeenCalledWith({ seats: [proposal], reason: "ajuste" }));
  });

  it("impede submits duplicados enquanto confirmação aguarda", async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>(r => { resolve = r; }));
    render(React.createElement(MapReview, { proposals: [proposal], onConfirm }));
    const button = screen.getByRole("button", { name: "Confirmar mapa" });
    fireEvent.click(button); fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(button).toHaveProperty("disabled", true);
    resolve();
  });

  it("impede retry duplicado enquanto a substituição aguarda", async () => {
    let resolve!: () => void;
    const onRetryDefaultMap = vi.fn(() => new Promise<void>(r => { resolve = r; }));
    render(React.createElement(MapReview, { proposals: [proposal], onRetryDefaultMap }));
    const button = screen.getByRole("button", { name: "Substituir mapa padrão novamente" });
    fireEvent.click(button); fireEvent.click(button);
    expect(onRetryDefaultMap).toHaveBeenCalledTimes(1);
    expect(button).toHaveProperty("disabled", true);
    resolve();
    await waitFor(() => expect(button).toHaveProperty("disabled", false));
  });
});
