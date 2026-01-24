import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DocumentoList } from "./documento-list";

describe("DocumentoList", () => {
  it("abre e fecha a previa ao clicar em Ver Documento", async () => {
    const user = userEvent.setup();
    render(
      <DocumentoList
        documentos={[
          {
            id: "doc-1",
            planoId: "plano-1",
            tipo: "ARQUIVO",
            fileName: "teste.pdf",
            mimeType: "application/pdf",
            url: "https://cdn/teste.pdf",
            createdAt: "2026-01-23T10:00:00.000Z",
            comentarios: [],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /ver documento/i }));
    expect(screen.getByText(/visualização do documento/i)).toBeInTheDocument();
  });

  it("mostra status de conversao pendente", () => {
    render(
      <DocumentoList
        documentos={[
          {
            id: "doc-1",
            planoId: "plano-1",
            tipo: "ARQUIVO",
            fileName: "teste.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            url: "https://cdn/teste.docx",
            createdAt: "2026-01-23T10:00:00.000Z",
            comentarios: [],
            previewStatus: "PENDENTE",
          },
        ]}
      />,
    );

    expect(screen.getByText(/convertendo/i)).toBeInTheDocument();
  });

  it("mostra preview quando conversao esta pronta", async () => {
    const user = userEvent.setup();
    render(
      <DocumentoList
        documentos={[
          {
            id: "doc-1",
            planoId: "plano-1",
            tipo: "ARQUIVO",
            fileName: "teste.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            url: "https://cdn/teste.docx",
            createdAt: "2026-01-23T10:00:00.000Z",
            comentarios: [],
            previewStatus: "PRONTO",
            previewUrl: "https://cdn/preview.pdf",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /ver documento/i }));
    expect(screen.getByTitle("Preview do documento")).toBeInTheDocument();
  });
});
