import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentoComentariosPanel } from "./documento-comentarios-panel";

describe("DocumentoComentariosPanel", () => {
  const mockComentarios = [
    {
      id: "c1",
      comentario: "Revisar formatação",
      resolved: false,
      createdAt: "2026-01-25T10:00:00.000Z",
      autorId: "user-1",
      autorName: "Maria Coordenadora",
    },
    {
      id: "c2",
      comentario: "Ótimo conteúdo!",
      resolved: true,
      createdAt: "2026-01-24T15:00:00.000Z",
      autorId: "user-2",
      autorName: "Ana Analista",
    },
  ];

  const defaultProps = {
    documentoId: "doc-1",
    documentoNome: "plano-aula.docx",
    comentarios: mockComentarios,
    isOpen: true,
    onClose: vi.fn(),
    onAddComentario: vi.fn().mockResolvedValue(undefined),
  };

  it("renderiza painel quando isOpen é true", () => {
    render(<DocumentoComentariosPanel {...defaultProps} />);

    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(screen.getByText("Comentários")).toBeInTheDocument();
  });

  it("não renderiza painel quando isOpen é false", () => {
    render(<DocumentoComentariosPanel {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("renderiza histórico de comentários", () => {
    render(<DocumentoComentariosPanel {...defaultProps} />);

    expect(screen.getByText("Revisar formatação")).toBeInTheDocument();
    expect(screen.getByText("Ótimo conteúdo!")).toBeInTheDocument();
    expect(screen.getByText("Maria Coordenadora")).toBeInTheDocument();
  });

  it("renderiza textarea para novo comentário", () => {
    render(<DocumentoComentariosPanel {...defaultProps} />);

    expect(screen.getByPlaceholderText(/digite seu comentário/i)).toBeInTheDocument();
  });

  it("botão submit está desabilitado quando textarea vazio", () => {
    render(<DocumentoComentariosPanel {...defaultProps} />);

    const botaoEnviar = screen.getByRole("button", { name: /adicionar comentário/i });
    expect(botaoEnviar).toBeDisabled();
  });

  it("habilita botão quando textarea tem texto", async () => {
    const user = userEvent.setup();
    render(<DocumentoComentariosPanel {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/digite seu comentário/i);
    await user.type(textarea, "Meu comentário");

    const botaoEnviar = screen.getByRole("button", { name: /adicionar comentário/i });
    expect(botaoEnviar).not.toBeDisabled();
  });

  it("chama onAddComentario e limpa textarea após sucesso", async () => {
    const user = userEvent.setup();
    const onAddComentario = vi.fn().mockResolvedValue(undefined);
    render(<DocumentoComentariosPanel {...defaultProps} onAddComentario={onAddComentario} />);

    const textarea = screen.getByPlaceholderText(/digite seu comentário/i);
    await user.type(textarea, "Novo comentário");

    const botaoEnviar = screen.getByRole("button", { name: /adicionar comentário/i });
    await user.click(botaoEnviar);

    expect(onAddComentario).toHaveBeenCalledWith("Novo comentário");
    expect(textarea).toHaveValue("");
  });

  it("mostra loading durante submit", async () => {
    const user = userEvent.setup();
    let resolvePromise: () => void;
    const onAddComentario = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
    });

    render(<DocumentoComentariosPanel {...defaultProps} onAddComentario={onAddComentario} />);

    const textarea = screen.getByPlaceholderText(/digite seu comentário/i);
    await user.type(textarea, "Comentário");

    const botaoEnviar = screen.getByRole("button", { name: /adicionar comentário/i });
    await user.click(botaoEnviar);

    expect(screen.getByRole("button", { name: /adicionar comentário/i })).toBeDisabled();

    resolvePromise!();
  });

  it("chama onClose ao clicar no botão X", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DocumentoComentariosPanel {...defaultProps} onClose={onClose} />);

    const botaoFechar = screen.getByRole("button", { name: /fechar painel/i });
    await user.click(botaoFechar);

    expect(onClose).toHaveBeenCalled();
  });

  it("mostra contador de caracteres", async () => {
    const user = userEvent.setup();
    render(<DocumentoComentariosPanel {...defaultProps} />);

    expect(screen.getByText("0/1000")).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/digite seu comentário/i);
    await user.type(textarea, "Teste");

    expect(screen.getByText("5/1000")).toBeInTheDocument();
  });

  it("renderiza mensagem quando não há comentários", () => {
    render(<DocumentoComentariosPanel {...defaultProps} comentarios={[]} />);

    expect(screen.getByText(/nenhum comentário ainda/i)).toBeInTheDocument();
  });

  it("fecha ao clicar no backdrop (mobile)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DocumentoComentariosPanel {...defaultProps} onClose={onClose} />);

    const backdrop = screen.getByTestId("comentarios-backdrop");
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });
});
