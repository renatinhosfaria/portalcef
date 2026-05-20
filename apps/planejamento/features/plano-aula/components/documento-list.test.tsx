import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentoList } from "./documento-list";

vi.mock("@essencia/ui/toaster", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "@essencia/ui/toaster";

describe("DocumentoList", () => {
  const fetchMock = vi.fn();

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

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.info).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("exibe botão Imprimir para documentos aprovados com URL imprimível (PDF nativo ou DOCX com pdfUrl), mas não para Word sem PDF derivado, não aprovado, ou YouTube", () => {
    const onImprimir = vi.fn().mockResolvedValue(undefined);

    const mockDocumentoWordAprovadoComPdf = {
      ...mockDocumentoAprovado,
      id: "doc-word-com-pdf",
      pdfUrl: "https://cdn/pdf/abc.pdf",
      pdfStorageKey: "pdf/abc.pdf",
    };

    const mockYoutubeAprovado = {
      id: "doc-youtube",
      planoId: "plano-1",
      tipo: "LINK_YOUTUBE" as const,
      fileName: null,
      mimeType: null,
      url: "https://youtu.be/abc123",
      createdAt: "2026-01-23T10:00:00.000Z",
      approvedBy: "analista-1",
      approvedAt: "2026-02-06T15:30:00.000Z",
    };

    render(
      <DocumentoList
        documentos={[
          mockDocumentoPdfAprovado, // PDF aprovado → imprime
          { ...mockDocumentoPdf, id: "doc-nao-aprovado" }, // não aprovado → não imprime
          mockDocumentoAprovado, // Word aprovado SEM pdfUrl → não imprime (fallback seguro)
          mockDocumentoWordAprovadoComPdf, // Word aprovado COM pdfUrl → imprime via PDF derivado
          mockYoutubeAprovado, // YouTube → não imprime
        ]}
        onImprimir={onImprimir}
      />,
    );

    const botoesImprimir = screen.getAllByRole("button", { name: /imprimir/i });
    expect(botoesImprimir).toHaveLength(2);
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
        canEdit={true}
        onAprovar={onAprovar}
      />,
    );

    expect(
      screen.getByRole("button", { name: /visualizar documento/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^editar no word$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /editar no word online \(teste\)/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /aprovar documento/i }),
    ).toBeInTheDocument();
    expect(document.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it("usa a rota de prova no visualizador quando renderizado no módulo de prova", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    render(
      <DocumentoList
        documentos={[
          { ...mockDocumentoWord, id: "doc-prova", planoId: "prova-1" },
        ]}
        modulo="prova"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /visualizar documento/i }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prova/prova-1/documentos/doc-prova/download",
        { credentials: "include" },
      );
    });
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

  it("mostra mensagem amigável quando a edição no Word recebe erro técnico da API", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        error: {
          code: "itemNotFound",
          message: "The resource could not be found.",
        },
      }),
    });

    render(
      <DocumentoList
        documentos={[mockDocumentoWord]}
        canEdit={true}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^editar no word$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não conseguimos abrir esse documento agora. Tente abrir novamente em alguns instantes.",
      );
    });
    expect(toast.error).not.toHaveBeenCalledWith(
      expect.stringContaining("resource"),
    );
  });
});
