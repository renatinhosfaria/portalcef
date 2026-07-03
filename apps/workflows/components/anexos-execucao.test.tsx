import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnexosExecucao } from "./anexos-execucao";

describe("AnexosExecucao", () => {
  it("preserva arquivo selecionado e mostra erro quando upload falha", async () => {
    const user = userEvent.setup();
    const arquivo = new File(["conteudo"], "documento.pdf", {
      type: "application/pdf",
    });
    const onEnviar = vi
      .fn()
      .mockRejectedValue(new Error("Não foi possível enviar o anexo."));

    render(
      <AnexosExecucao
        anexos={[]}
        onEnviar={onEnviar}
        onRemover={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Novo anexo") as HTMLInputElement;
    await user.upload(input, arquivo);
    await user.click(screen.getByRole("button", { name: "Enviar anexo" }));

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível enviar o anexo."),
      ).toBeInTheDocument(),
    );
    expect(input.files?.[0]).toBe(arquivo);
    expect(onEnviar).toHaveBeenCalledTimes(1);
  });
});
