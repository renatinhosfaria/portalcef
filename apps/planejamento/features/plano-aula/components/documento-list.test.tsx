import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentoList } from "./documento-list";

describe("DocumentoList", () => {
  const mockDocumentoPronto = {
    id: "doc-1",
    planoId: "plano-1",
    tipo: "ARQUIVO" as const,
    fileName: "teste.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    url: "https://cdn/teste.docx",
    previewUrl: "https://cdn/teste.pdf",
    previewStatus: "PRONTO" as const,
    createdAt: "2026-01-23T10:00:00.000Z",
    comentarios: [],
  };

  const mockDocumentoAprovado = {
    ...mockDocumentoPronto,
    id: "doc-aprovado",
    approvedBy: "analista-1",
    approvedAt: "2026-02-06T15:30:00.000Z",
  };

  const mockDocumentoPendente = {
    ...mockDocumentoPronto,
    id: "doc-2",
    previewStatus: "PENDENTE" as const,
    previewUrl: undefined,
  };

  it("abre modal ao clicar em Ver Documento quando status é PRONTO", async () => {
    const user = userEvent.setup();
    render(<DocumentoList documentos={[mockDocumentoPronto]} />);

    await user.click(screen.getByRole("button", { name: /ver documento/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("desabilita botão Ver Documento quando status é PENDENTE", () => {
    render(<DocumentoList documentos={[mockDocumentoPendente]} />);

    const botao = screen.getByRole("button", { name: /ver documento/i });
    expect(botao).toBeDisabled();
  });

  it("mostra badge Convertendo quando status é PENDENTE", () => {
    render(<DocumentoList documentos={[mockDocumentoPendente]} />);

    expect(screen.getByText(/convertendo/i)).toBeInTheDocument();
  });

  it("fecha modal ao clicar no botão Fechar", async () => {
    const user = userEvent.setup();
    render(<DocumentoList documentos={[mockDocumentoPronto]} />);

    await user.click(screen.getByRole("button", { name: /ver documento/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /fechar/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderiza mensagem de lista vazia quando não há documentos", () => {
    render(<DocumentoList documentos={[]} />);

    expect(screen.getByText(/nenhum documento anexado/i)).toBeInTheDocument();
  });

  it("habilita botão Ver Documento para PDF nativo (sem conversão)", () => {
    const mockPdf = {
      ...mockDocumentoPronto,
      mimeType: "application/pdf",
      previewStatus: undefined,
      previewUrl: undefined,
    };

    render(<DocumentoList documentos={[mockPdf]} />);

    const botao = screen.getByRole("button", { name: /ver documento/i });
    expect(botao).not.toBeDisabled();
  });

  it("exibe botão Imprimir apenas para documento aprovado", () => {
    const onImprimir = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoList
        documentos={[
          mockDocumentoAprovado,
          { ...mockDocumentoPronto, id: "doc-nao-aprovado" },
        ]}
        onImprimir={onImprimir}
      />,
    );

    const botoesImprimir = screen.getAllByRole("button", { name: /imprimir/i });
    expect(botoesImprimir).toHaveLength(1);
  });

  it("chama callback onImprimir ao clicar no botão Imprimir", async () => {
    const user = userEvent.setup();
    const onImprimir = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoList
        documentos={[mockDocumentoAprovado]}
        onImprimir={onImprimir}
      />,
    );

    await user.click(screen.getByRole("button", { name: /imprimir/i }));

    expect(onImprimir).toHaveBeenCalledTimes(1);
    expect(onImprimir).toHaveBeenCalledWith("doc-aprovado");
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

    expect(screen.getByText(/impresso em/i)).toBeInTheDocument();
  });
});
