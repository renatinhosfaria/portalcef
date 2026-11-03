// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResultadoPublicacao } from "./resultado-publicacao";

afterEach(() => cleanup());

describe("ResultadoPublicacao", () => {
  it("não oferece upload, campos de edição nem confirmação do mapa", () => {
    render(React.createElement(ResultadoPublicacao, {}));
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirmar mapa" })).toBeNull();
    expect(screen.queryByPlaceholderText("Motivo da correção")).toBeNull();
  });

  it("exibe ARCHIVED e MAP_IN_USE com as sessões", () => {
    const { rerender } = render(React.createElement(ResultadoPublicacao, { previousMapArchive: { archived: true, code: "ARCHIVED" } }));
    expect(screen.getByText(/versão anterior arquivada/i)).toBeTruthy();
    rerender(React.createElement(ResultadoPublicacao, { previousMapArchive: { archived: false, code: "MAP_IN_USE", sessionIds: ["sessao-1"] } }));
    expect(screen.getByText(/preservado/i)).toHaveProperty("textContent", expect.stringContaining("sessao-1"));
  });

  it("exibe o inventário gerado e as sessões afetadas", () => {
    render(React.createElement(ResultadoPublicacao, { inventoryCreatedCount: 5, inventorySessionIds: ["s1", "s2"], affectedSessionIds: ["s1"] }));
    expect(screen.getByText("Inventário gerado: 5 assento(s) em 2 sessão(ões).")).toBeTruthy();
    expect(screen.getByText("Revise o inventário de 1 sessão(ões) após a troca do mapa.")).toBeTruthy();
  });

  it("impede retry duplicado enquanto a substituição aguarda", async () => {
    let resolve!: () => void;
    const onRetryDefaultMap = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(React.createElement(ResultadoPublicacao, { onRetryDefaultMap }));
    const button = screen.getByRole("button", { name: "Substituir mapa padrão novamente" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onRetryDefaultMap).toHaveBeenCalledTimes(1);
    expect(button).toHaveProperty("disabled", true);
    resolve();
    await waitFor(() => expect(button).toHaveProperty("disabled", false));
  });

  it("oferece migração apenas quando o mapa anterior está em uso e mostra DELETED após sucesso", async () => {
    const onMigrateAndDelete = vi.fn().mockResolvedValue({
      migratedSessionIds: ["sessao-1"],
      inheritedSessionIds: [],
      inventoryCreatedCount: 12,
      deletedMap: { deleted: true, code: "DELETED" as const },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { rerender } = render(React.createElement(ResultadoPublicacao, {
      previousMapArchive: { archived: false, code: "MAP_IN_USE", sessionIds: ["sessao-1"] },
      onMigrateAndDelete,
    }));
    fireEvent.click(screen.getByRole("button", { name: "Migrar sessões e excluir mapa anterior" }));
    await waitFor(() => expect(onMigrateAndDelete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/mapa anterior excluído/i)).toBeTruthy());
    expect(screen.getByText(/1 sessão/)).toBeTruthy();
    rerender(React.createElement(ResultadoPublicacao, { previousMapArchive: { archived: true, code: "ARCHIVED" }, onMigrateAndDelete }));
    expect(screen.queryByRole("button", { name: "Migrar sessões e excluir mapa anterior" })).toBeNull();
  });

  it("não exibe a ação de migração sem MAP_IN_USE ou sem callback", () => {
    const onMigrateAndDelete = vi.fn();
    const { rerender } = render(React.createElement(ResultadoPublicacao, { previousMapArchive: { archived: true, code: "ARCHIVED" }, onMigrateAndDelete }));
    expect(screen.queryByRole("button", { name: "Migrar sessões e excluir mapa anterior" })).toBeNull();
    rerender(React.createElement(ResultadoPublicacao, { previousMapArchive: { archived: false, code: "MAP_IN_USE" } }));
    expect(screen.queryByRole("button", { name: "Migrar sessões e excluir mapa anterior" })).toBeNull();
  });
});
