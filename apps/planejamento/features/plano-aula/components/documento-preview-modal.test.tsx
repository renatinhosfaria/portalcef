import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentoPreviewModal } from "./documento-preview-modal";

describe("DocumentoPreviewModal", () => {
  const mockDocumento = {
    id: "doc-1",
    planoId: "plano-1",
    tipo: "ARQUIVO" as const,
    fileName: "relatorio.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    url: "https://cdn.example.com/relatorio.docx",
    previewUrl: "https://cdn.example.com/relatorio.pdf",
    previewStatus: "PRONTO" as const,
    createdAt: "2026-01-24T10:00:00.000Z",
    comentarios: [],
  };

  const mockDocumentoComComentarios = {
    ...mockDocumento,
    comentarios: [
      {
        id: "c1",
        comentario: "Revisar formatação",
        resolved: false,
        createdAt: "2026-01-25T10:00:00.000Z",
        autorId: "user-1",
        autorName: "Maria Coordenadora",
      },
    ],
  };

  it("renderiza modal quando open é true", () => {
    render(
      <DocumentoPreviewModal
        documento={mockDocumento}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("não renderiza modal quando open é false", () => {
    render(
      <DocumentoPreviewModal
        documento={mockDocumento}
        open={false}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exibe iframe com previewUrl quando documento está PRONTO", () => {
    render(
      <DocumentoPreviewModal
        documento={mockDocumento}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    const iframe = screen.getByTitle("Preview do documento");
    expect(iframe).toHaveAttribute("src", mockDocumento.previewUrl);
  });

  it("exibe mensagem de erro quando previewStatus é ERRO", () => {
    const docComErro = {
      ...mockDocumento,
      previewStatus: "ERRO" as const,
      previewError: "Falha na conversão do arquivo",
      previewUrl: undefined,
    };

    render(
      <DocumentoPreviewModal
        documento={docComErro}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText(/erro ao converter documento/i)).toBeInTheDocument();
    expect(screen.getByText(/falha na conversão do arquivo/i)).toBeInTheDocument();
  });

  it("botão Baixar PDF está habilitado quando status é PRONTO", () => {
    render(
      <DocumentoPreviewModal
        documento={mockDocumento}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    const botaoPdf = screen.getByRole("button", { name: /baixar pdf/i });
    expect(botaoPdf).not.toBeDisabled();
  });

  it("botão Baixar PDF está desabilitado quando status é ERRO", () => {
    const docComErro = {
      ...mockDocumento,
      previewStatus: "ERRO" as const,
      previewUrl: undefined,
    };

    render(
      <DocumentoPreviewModal
        documento={docComErro}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    const botaoPdf = screen.getByRole("button", { name: /baixar pdf/i });
    expect(botaoPdf).toBeDisabled();
  });

  it("botão Baixar Original está sempre habilitado", () => {
    render(
      <DocumentoPreviewModal
        documento={mockDocumento}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    const botaoOriginal = screen.getByRole("button", { name: /baixar original/i });
    expect(botaoOriginal).not.toBeDisabled();
  });

  it("chama onOpenChange(false) ao clicar no botão Fechar", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <DocumentoPreviewModal
        documento={mockDocumento}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    const botaoFechar = screen.getByRole("button", { name: /fechar/i });
    await user.click(botaoFechar);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renderiza botão flutuante de comentários", () => {
    render(
      <DocumentoPreviewModal
        documento={mockDocumentoComComentarios}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    const botaoComentarios = screen.getByRole("button", { name: /abrir comentários/i });
    expect(botaoComentarios).toBeInTheDocument();
  });

  it("mostra badge com número de comentários pendentes", () => {
    render(
      <DocumentoPreviewModal
        documento={mockDocumentoComComentarios}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("abre painel de comentários ao clicar no botão flutuante", async () => {
    const user = userEvent.setup();
    render(
      <DocumentoPreviewModal
        documento={mockDocumentoComComentarios}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    const botaoComentarios = screen.getByRole("button", { name: /abrir comentários/i });
    await user.click(botaoComentarios);

    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("chama onAddComentario quando novo comentário é enviado", async () => {
    const user = userEvent.setup();
    const onAddComentario = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoPreviewModal
        documento={mockDocumentoComComentarios}
        open={true}
        onOpenChange={() => {}}
        onAddComentario={onAddComentario}
      />,
    );

    // Abrir painel
    const botaoComentarios = screen.getByRole("button", { name: /abrir comentários/i });
    await user.click(botaoComentarios);

    // Digitar comentário
    const textarea = screen.getByPlaceholderText(/digite seu comentário/i);
    await user.type(textarea, "Novo comentário");

    // Enviar
    const botaoEnviar = screen.getByRole("button", { name: /adicionar comentário/i });
    await user.click(botaoEnviar);

    expect(onAddComentario).toHaveBeenCalledWith("doc-1", "Novo comentário");
  });
});
