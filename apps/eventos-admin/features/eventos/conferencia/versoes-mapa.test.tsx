// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VersoesMapa } from "./versoes-mapa";

const versao = { id: "m1", version: 2, status: "CONFIRMADO" as const, originalFileName: "planta.pdf", createdAt: "2026-11-01T10:00:00Z", confirmedAt: "2026-11-01T11:00:00Z", atual: true, lugares: 10, sessoes: [{ id: "s1", startsAt: "2026-12-01T10:00:00Z" }], editavel: true };
const props = { versoes: [versao], trava: { tipo: "LIVRE", mensagem: null }, ocupado: false, onEditar: vi.fn(), onExcluir: vi.fn() };
afterEach(cleanup);

describe("VersoesMapa", () => {
  it("mostra situação, arquivo, lugares e sessões", () => {
    render(<VersoesMapa {...props} />);
    expect(screen.getByText("Versão 2")).toBeTruthy(); expect(screen.getByText("Atual")).toBeTruthy(); expect(screen.getByText("planta.pdf")).toBeTruthy(); expect(screen.getByText("10 lugares")).toBeTruthy(); expect(screen.getByText(/01\/12\/2026/)).toBeTruthy();
  });
  it("desabilita ações e mostra a mensagem da trava", () => {
    render(<VersoesMapa {...props} trava={{ tipo: "VENDA_CONFIRMADA", mensagem: "Bloqueado: já há lugares vendidos" }} />);
    expect(screen.getByRole("alert").textContent).toContain("Bloqueado: já há lugares vendidos"); expect((screen.getByRole("button", { name: "Editar versão 2" }) as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: "Excluir versão 2" })).toBeNull();
  });
});
