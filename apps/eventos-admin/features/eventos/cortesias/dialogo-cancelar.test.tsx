// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CortesiaResumo } from "@essencia/shared/types";
import { DialogoCancelar } from "./dialogo-cancelar";

afterEach(() => cleanup());
const cortesia = { orderId: "pedido-1", rowLabel: "B", seatNumber: "4", participantName: "Maria" } as CortesiaResumo;

describe("DialogoCancelar", () => {
  it("exige motivo mínimo e envia o motivo aparado", async () => {
    const aoConfirmar = vi.fn().mockResolvedValue(undefined);
    render(<DialogoCancelar cortesia={cortesia} aoConfirmar={aoConfirmar} aoFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: " a " } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar cortesia" }));
    expect(aoConfirmar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: " erro de digitação " } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar cortesia" }));
    await waitFor(() => expect(aoConfirmar).toHaveBeenCalledWith("erro de digitação"));
  });

  it("não vaza motivo nem erro entre cortesias diferentes", async () => {
    const aoConfirmar = vi.fn().mockRejectedValue(new Error("falha"));
    const outra = { ...cortesia, orderId: "pedido-2", participantName: "João" } as CortesiaResumo;
    const { rerender } = render(<DialogoCancelar cortesia={cortesia} aoConfirmar={aoConfirmar} aoFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "erro de digitação" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar cortesia" }));
    await waitFor(() => expect(screen.getByRole("alert")).not.toBeNull());
    rerender(<DialogoCancelar cortesia={null} aoConfirmar={aoConfirmar} aoFechar={vi.fn()} />);
    rerender(<DialogoCancelar cortesia={outra} aoConfirmar={aoConfirmar} aoFechar={vi.fn()} />);
    expect((screen.getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mostra mensagem quando o ingresso já foi usado", async () => {
    const aoConfirmar = vi.fn().mockRejectedValue({ code: "CORTESIA_JA_UTILIZADA" });
    render(<DialogoCancelar cortesia={cortesia} aoConfirmar={aoConfirmar} aoFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "erro" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar cortesia" }));
    await waitFor(() => expect(screen.getByText("Este ingresso já foi usado na entrada e não pode ser cancelado.")).not.toBeNull());
  });
});
