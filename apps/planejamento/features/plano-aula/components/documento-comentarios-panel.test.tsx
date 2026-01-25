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
});
