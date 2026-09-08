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

  it("oculta detalhes técnicos desconhecidos retornados pela exclusão", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi
      .fn()
      .mockRejectedValue(new Error("Database connection reset by peer"));

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

    await waitFor(() => {
      expect(
        screen.getByText(
          "Não foi possível excluir o arquivo agora. Tente novamente.",
        ),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Database connection reset by peer"),
    ).not.toBeInTheDocument();
  });

  it("converte erro de domínio de documento aprovado em mensagem amigável", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn().mockRejectedValue(
      Object.assign(new Error("Regra interna de aprovação"), {
        code: "DOCUMENTO_APROVADO",
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

    await waitFor(() => {
      expect(
        screen.getByText("Este arquivo já foi aprovado e não pode ser excluído."),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Regra interna de aprovação"),
    ).not.toBeInTheDocument();
  });

  it("cancela sem confirmar a exclusão", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <ConfirmarExclusaoDocumentoDialog
        open
        onOpenChange={onOpenChange}
        documentoId="doc-1"
        nomeArquivo="planejamento.pdf"
        onConfirmar={onConfirmar}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onConfirmar).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sinaliza carregamento enquanto aguarda a confirmação", async () => {
    const user = userEvent.setup();
    let liberarConfirmacao: (() => void) | undefined;
    const onOpenChange = vi.fn();
    const onConfirmar = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          liberarConfirmacao = resolve;
        }),
    );

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
      "Arquivo duplicado no planejamento",
    );
    await user.click(screen.getByRole("button", { name: /excluir arquivo/i }));

    expect(
      screen.getByRole("button", { name: /excluindo arquivo/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("textbox", { name: /motivo da exclusão/i }),
    ).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    liberarConfirmacao?.();
    await waitFor(() => {
      expect(onConfirmar).toHaveBeenCalledTimes(1);
    });
  });

  it("marca o motivo como obrigatório e usa IDs únicos em múltiplas instâncias", () => {
    render(
      <>
        <ConfirmarExclusaoDocumentoDialog
          open
          onOpenChange={vi.fn()}
          documentoId="doc-1"
          nomeArquivo="primeiro.pdf"
          onConfirmar={vi.fn().mockResolvedValue(undefined)}
        />
        <ConfirmarExclusaoDocumentoDialog
          open
          onOpenChange={vi.fn()}
          documentoId="doc-2"
          nomeArquivo="segundo.pdf"
          onConfirmar={vi.fn().mockResolvedValue(undefined)}
        />
      </>,
    );

    const camposMotivo = screen.getAllByRole("textbox", {
      name: /motivo da exclusão/i,
      hidden: true,
    });
    const ids = camposMotivo.map((campo) => campo.getAttribute("id"));

    expect(camposMotivo[0]).toBeRequired();
    expect(camposMotivo[0]).toHaveAttribute("aria-required", "true");
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });
});
