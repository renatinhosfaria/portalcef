// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileDrawer } from "./mobile-drawer";

describe("MobileDrawer", () => {
  it("abre com foco, fecha com Escape e mantém o foco dentro do menu", () => {
    render(
      <MobileDrawer title="Menu principal">
        <a href="/usuarios">Usuários</a>
        <button type="button">Sair</button>
      </MobileDrawer>,
    );

    const abrir = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(abrir);

    const dialogo = screen.getByRole("dialog", { name: "Menu principal" });
    expect(dialogo).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar menu" }));

    fireEvent.keyDown(dialogo, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sair" }));

    fireEvent.keyDown(dialogo, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(abrir);
  });
});
