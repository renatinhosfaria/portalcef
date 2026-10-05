import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sheet } from "./sheet";

describe("Sheet", () => {
  it("expõe diálogo nomeado e fecha com Escape", () => {
    const onClose = vi.fn();
    render(
      <Sheet isOpen onClose={onClose} title="Editar escola">
        <button>Salvar</button>
      </Sheet>,
    );

    const dialog = screen.getByRole("dialog", { name: "Editar escola" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("dá nome acessível ao botão de fechar", () => {
    render(
      <Sheet isOpen onClose={() => undefined} title="Detalhes">
        <p>Conteúdo</p>
      </Sheet>,
    );
    expect(
      screen.getByRole("button", { name: /fechar detalhes/i }),
    ).toBeInTheDocument();
  });
});

it("nomeia o diálogo mesmo sem título", () => {
  render(
    <Sheet isOpen onClose={() => undefined}>
      Conteúdo
    </Sheet>,
  );
  expect(
    screen.getByRole("dialog", { name: "Painel lateral" }),
  ).toBeInTheDocument();
});
