import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmarExclusaoDocumentoDialog } from "./confirmar-exclusao-documento-dialog";

describe("ConfirmarExclusaoDocumentoDialog", () => {
  it("desabilita a confirmação enquanto o motivo tiver menos de 10 caracteres", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfirmarExclusaoDocumentoDialog
        open
        onOpenChange={vi.fn()}
        documentoId="doc-1"
        nomeArquivo="planejamento.pdf"
        onConfirmar={onConfirmar}
      />,
    );

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "planejamento.pdf",
    );

    const botaoConfirmar = screen.getByRole("button", {
      name: /excluir arquivo/i,
    });
    const motivo = screen.getByRole("textbox", {
      name: /motivo da exclusão/i,
    });

    expect(botaoConfirmar).toBeDisabled();
    await user.type(motivo, "curto");
    expect(botaoConfirmar).toBeDisabled();

    await user.type(motivo, "12345");
    expect(botaoConfirmar).not.toBeDisabled();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("chama onConfirmar somente com motivo válido e fecha após sucesso", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const motivo = "Arquivo enviado com conteúdo incorreto";

    render(
      <ConfirmarExclusaoDocumentoDialog
        open
        onOpenChange={onOpenChange}
        documentoId="doc-1"
        nomeArquivo="planejamento.pdf"
        onConfirmar={onConfirmar}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /motivo da exclusão/i }),
      motivo,
    );
    await user.click(screen.getByRole("button", { name: /excluir arquivo/i }));

    await waitFor(() => {
      expect(onConfirmar).toHaveBeenCalledWith("doc-1", motivo);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("oculta erro técnico em inglês e mantém o motivo quando a exclusão falha", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi
      .fn()
      .mockRejectedValue(new Error("Failed to delete document"));
    const motivo = "Arquivo duplicado no planejamento";

    render(
      <ConfirmarExclusaoDocumentoDialog
        open
        onOpenChange={vi.fn()}
        documentoId="doc-1"
        nomeArquivo="planejamento.pdf"
        onConfirmar={onConfirmar}
      />,
    );

    const campoMotivo = screen.getByRole("textbox", {
      name: /motivo da exclusão/i,
    });
    await user.type(campoMotivo, motivo);
    await user.click(screen.getByRole("button", { name: /excluir arquivo/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Não foi possível excluir o arquivo agora. Tente novamente.",
        ),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Failed to delete document"),
    ).not.toBeInTheDocument();
    expect(campoMotivo).toHaveValue(motivo);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("sinaliza carregamento enquanto aguarda a confirmação", async () => {
    const user = userEvent.setup();
    let liberarConfirmacao: (() => void) | undefined;
    const onConfirmar = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          liberarConfirmacao = resolve;
        }),
    );

    render(
      <ConfirmarExclusaoDocumentoDialog
        open
        onOpenChange={vi.fn()}
        documentoId="doc-1"
        nomeArquivo="planejamento.pdf"
        onConfirmar={onConfirmar}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /motivo da exclusão/i }),
      "Arquivo duplicado no planejamento",
    );
    await user.click(screen.getByRole("button", { name: /excluir arquivo/i }));

    expect(
      screen.getByRole("button", { name: /excluindo arquivo/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("textbox", { name: /motivo da exclusão/i }),
    ).toBeDisabled();

    liberarConfirmacao?.();
    await waitFor(() => {
      expect(onConfirmar).toHaveBeenCalledTimes(1);
    });
  });
});
