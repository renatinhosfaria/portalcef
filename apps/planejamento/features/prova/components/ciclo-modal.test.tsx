import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CicloModal } from "./ciclo-modal";

describe("CicloModal", () => {
  it("bloqueia prazo de entrega igual ou posterior ao inicio do ciclo", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CicloModal
        open
        onOpenChange={vi.fn()}
        etapas={["INFANTIL"]}
        defaultEtapa="INFANTIL"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/data de inicio/i), {
      target: { value: "2026-06-10" },
    });
    fireEvent.change(screen.getByLabelText(/data de fim/i), {
      target: { value: "2026-06-20" },
    });
    fireEvent.change(screen.getByLabelText(/prazo de entrega/i), {
      target: { value: "2026-06-10" },
    });

    await user.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
    expect(
      screen.getByText("O prazo de entrega deve ser anterior ao inicio do ciclo."),
    ).toBeInTheDocument();
  });
});
