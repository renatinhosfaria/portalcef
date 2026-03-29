import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentoList } from "./documento-list";

describe("DocumentoList", () => {
  const mockDocumentoWord = {
    id: "doc-1",
    planoId: "plano-1",
    tipo: "ARQUIVO" as const,
    fileName: "teste.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    url: "https://cdn/teste.docx",
    createdAt: "2026-01-23T10:00:00.000Z",
  };

  const mockDocumentoAprovado = {
    ...mockDocumentoWord,
    id: "doc-aprovado",
    approvedBy: "analista-1",
    approvedAt: "2026-02-06T15:30:00.000Z",
  };

  const mockDocumentoPdf = {
    ...mockDocumentoWord,
    id: "doc-pdf",
    fileName: "teste.pdf",
    mimeType: "application/pdf",
    url: "https://cdn/teste.pdf",
  };

  const mockDocumentoPdfAprovado = {
    ...mockDocumentoPdf,
    id: "doc-pdf-aprovado",
    approvedBy: "analista-1",
    approvedAt: "2026-02-06T15:30:00.000Z",
  };

  it("abre modal ao clicar em Visualizar para documento Word", async () => {
    const user = userEvent.setup();
    render(<DocumentoList documentos={[mockDocumentoWord]} />);

    await user.click(
      screen.getByRole("button", { name: /visualizar documento/i }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("fecha modal ao clicar no botão Fechar", async () => {
    const user = userEvent.setup();
    render(<DocumentoList documentos={[mockDocumentoWord]} />);

    await user.click(
      screen.getByRole("button", { name: /visualizar documento/i }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderiza mensagem de lista vazia quando não há documentos", () => {
    render(<DocumentoList documentos={[]} />);

    expect(screen.getByText(/nenhum documento anexado/i)).toBeInTheDocument();
  });

  it("habilita botão Ver para PDF nativo", () => {
    render(<DocumentoList documentos={[mockDocumentoPdf]} />);

    const botao = screen.getByRole("button", {
      name: /visualizar documento/i,
    });
    expect(botao).not.toBeDisabled();
  });

  it("exibe botão Imprimir apenas para documento PDF aprovado", () => {
    const onImprimir = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoList
        documentos={[
          mockDocumentoPdfAprovado,
          { ...mockDocumentoPdf, id: "doc-nao-aprovado" },
          mockDocumentoAprovado, // Word aprovado - não deve ter imprimir
        ]}
        onImprimir={onImprimir}
      />,
    );

    const botoesImprimir = screen.getAllByRole("button", { name: /imprimir/i });
    expect(botoesImprimir).toHaveLength(1);
  });

  it("chama callback onImprimir ao clicar no botão Imprimir e confirmar", async () => {
    const user = userEvent.setup();
    const onImprimir = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoList
        documentos={[mockDocumentoPdfAprovado]}
        onImprimir={onImprimir}
      />,
    );

    await user.click(screen.getByRole("button", { name: /imprimir/i }));

    // Apos clicar em imprimir, o dialog de confirmacao deve aparecer
    expect(screen.getByText("O documento foi impresso com sucesso?")).toBeInTheDocument();

    // Confirmar a impressao
    await user.click(screen.getByRole("button", { name: /sim, foi impresso/i }));

    expect(onImprimir).toHaveBeenCalledTimes(1);
    expect(onImprimir).toHaveBeenCalledWith("doc-pdf-aprovado");
  });

  it("nao chama callback onImprimir ao cancelar confirmacao de impressao", async () => {
    const user = userEvent.setup();
    const onImprimir = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoList
        documentos={[mockDocumentoPdfAprovado]}
        onImprimir={onImprimir}
      />,
    );

    await user.click(screen.getByRole("button", { name: /imprimir/i }));

    // Cancelar a impressao
    await user.click(screen.getByRole("button", { name: /nao, cancelar/i }));

    expect(onImprimir).not.toHaveBeenCalled();
  });

  it("exibe as acoes de documento inline sem menu de overflow", () => {
    const onAprovar = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoList
        documentos={[mockDocumentoWord]}
        canAprovar={true}
        onAprovar={onAprovar}
      />,
    );

    expect(
      screen.getByRole("button", { name: /visualizar documento/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /editar no word/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /aprovar documento/i }),
    ).toBeInTheDocument();
    expect(document.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it("mostra data e horário quando documento já foi impresso", () => {
    render(
      <DocumentoList
        documentos={[
          {
            ...mockDocumentoAprovado,
            printedAt: "2026-02-06T16:45:00.000Z",
          } as typeof mockDocumentoAprovado & { printedAt: string },
        ]}
      />,
    );

    expect(screen.getByText(/impresso/i)).toBeInTheDocument();
  });
});
