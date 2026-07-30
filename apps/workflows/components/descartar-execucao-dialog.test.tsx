import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DescartarExecucaoDialog } from "./descartar-execucao-dialog";

describe("DescartarExecucaoDialog", () => {
  it("confirma o descarte da execução de teste", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn();

    render(
      <DescartarExecucaoDialog
        open
        onOpenChange={vi.fn()}
        onConfirmar={onConfirmar}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Confirmar descarte" }),
    );

    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it("mantém o diálogo aberto quando o descarte falha", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi
      .fn()
      .mockRejectedValue(new Error("Não foi possível descartar."));

    render(
      <DescartarExecucaoDialog
        open
        onOpenChange={vi.fn()}
        onConfirmar={onConfirmar}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Confirmar descarte" }),
    );

    expect(
      await screen.findByText("Não foi possível descartar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
