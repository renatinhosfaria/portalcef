import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CancelarExecucaoDialog } from "./cancelar-execucao-dialog";

describe("CancelarExecucaoDialog", () => {
  it("mantem dialog aberto e mostra erro quando confirmacao falha", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirmar = vi
      .fn()
      .mockRejectedValue(new Error("Falha ao cancelar execução."));

    render(
      <CancelarExecucaoDialog
        open
        titulo="Cancelar execução"
        descricao="Informe o motivo para cancelar."
        rotuloConfirmacao="Cancelar execução"
        onOpenChange={onOpenChange}
        onConfirmar={onConfirmar}
      />,
    );

    await user.type(screen.getByLabelText("Motivo"), "Motivo válido");
    await user.click(
      screen.getByRole("button", { name: "Cancelar execução" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Falha ao cancelar execução.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
