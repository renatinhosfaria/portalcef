import { toast } from "@essencia/ui/toaster";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  enviarEventosPendentes,
  registrarEventoObservabilidade,
} from "../../../lib/observabilidade";

import type { PlanoDocumento } from "../types";
import { DocumentoList } from "./documento-list";

vi.mock("../../../lib/observabilidade", () => ({
  enviarEventosPendentes: vi.fn().mockResolvedValue(undefined),
  registrarEventoObservabilidade: vi.fn(),
}));

vi.mock("@essencia/ui/toaster", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

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
    vi.mocked(registrarEventoObservabilidade).mockReset();
    vi.mocked(enviarEventosPendentes).mockClear();
    vi.mocked(enviarEventosPendentes).mockResolvedValue(undefined);
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

  it("registra acao ao clicar em Visualizar para documento Word", async () => {
    const user = userEvent.setup();
    render(<DocumentoList documentos={[mockDocumentoWord]} />);

    await user.click(
      screen.getByRole("button", { name: /visualizar documento/i }),
    );

    expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "arquivo_acao",
        nivel: "info",
        arquivo: expect.objectContaining({
          planoId: "plano-1",
          documentoId: "doc-1",
          nome: "teste.docx",
          tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        detalhes: expect.objectContaining({
          acao: "visualizar",
          modulo: "plano-aula",
        }),
      }),
    );
    expect(enviarEventosPendentes).toHaveBeenCalled();
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

  it("trata YOUTUBE como link e não permite imprimir ou excluir", () => {
    const onDelete = vi.fn();
    const onImprimir = vi.fn().mockResolvedValue(undefined);
    const documentoYoutube: PlanoDocumento = {
      id: "doc-youtube-legado",
      planoId: "plano-1",
      tipo: "YOUTUBE" as const,
      fileName: null,
      mimeType: "application/pdf",
      url: "https://youtu.be/abc123",
      createdAt: "2026-01-23T10:00:00.000Z",
      approvedBy: "analista-1",
      approvedAt: "2026-02-06T15:30:00.000Z",
    };

    render(
      <DocumentoList
        documentos={[documentoYoutube]}
        canDelete
        onDelete={onDelete}
        onImprimir={onImprimir}
      />,
    );

    expect(screen.getByText(/video youtube: abc123/i)).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://youtu.be/abc123",
    );
    expect(
      screen.queryByRole("button", { name: /excluir documento/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /imprimir documento/i }),
    ).not.toBeInTheDocument();
    expect(document.querySelector("svg.lucide-youtube")).toBeInTheDocument();
  });

  it("trata UPLOAD como arquivo e permite excluir quando não aprovado", () => {
    const onDelete = vi.fn();
    const documentoUpload = {
      ...mockDocumentoPdf,
      id: "doc-upload-legado",
      tipo: "UPLOAD" as const,
      fileName: "arquivo-legado.pdf",
    };

    render(
      <DocumentoList
        documentos={[documentoUpload]}
        canDelete
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /arquivo-legado\.pdf/i }),
    ).toHaveAttribute("href", "https://cdn/teste.pdf");
    expect(
      screen.getByRole("button", { name: /excluir documento/i }),
    ).toBeInTheDocument();
  });

  it("registra acao ao clicar em Visualizar para documento PDF", async () => {
    const user = userEvent.setup();
    const abrirJanela = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<DocumentoList documentos={[mockDocumentoPdf]} />);

    await user.click(
      screen.getByRole("button", { name: /visualizar documento/i }),
    );

    expect(abrirJanela).toHaveBeenCalledWith("https://cdn/teste.pdf", "_blank");
    expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "arquivo_acao",
        nivel: "info",
        arquivo: expect.objectContaining({
          planoId: "plano-1",
          documentoId: "doc-pdf",
          nome: "teste.pdf",
          tipo: "application/pdf",
        }),
        detalhes: expect.objectContaining({
          acao: "visualizar",
          modulo: "plano-aula",
        }),
      }),
    );
    expect(enviarEventosPendentes).toHaveBeenCalled();

    abrirJanela.mockRestore();
  });

  it("registra acao ao clicar no nome do documento com link direto", async () => {
    const user = userEvent.setup();

    render(<DocumentoList documentos={[mockDocumentoPdf]} />);

    const linkDocumento = screen.getByRole("link", { name: /teste\.pdf/i });
    expect(linkDocumento).toHaveAttribute("href", "https://cdn/teste.pdf");
    expect(linkDocumento).toHaveAttribute("target", "_blank");

    await user.click(linkDocumento);

    expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "arquivo_acao",
        nivel: "info",
        arquivo: expect.objectContaining({
          planoId: "plano-1",
          documentoId: "doc-pdf",
          nome: "teste.pdf",
          tipo: "application/pdf",
        }),
        detalhes: expect.objectContaining({
          acao: "visualizar",
          modulo: "plano-aula",
        }),
      }),
    );
    expect(enviarEventosPendentes).toHaveBeenCalled();
  });

  it("exibe botão Imprimir para documentos aprovados com URL imprimível (PDF nativo ou DOCX com pdfUrl), mas não para Word sem PDF derivado, não aprovado, ou YouTube", () => {
    const onImprimir = vi.fn().mockResolvedValue(undefined);

    const mockDocumentoWordAprovadoComPdf = {
      ...mockDocumentoAprovado,
      id: "doc-word-com-pdf",
      pdfUrl: "https://cdn/pdf/abc.pdf",
      pdfStorageKey: "pdf/abc.pdf",
      pdfStatus: "PRONTO" as const,
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

  it("permite impressão de PDF de prova antes da aprovação quando liberado pelo fluxo de gestão", () => {
    render(
      <DocumentoList
        documentos={[mockDocumentoPdf]}
        onImprimir={vi.fn()}
        modulo="prova"
        permitirImpressaoSemAprovacao
      />,
    );

    expect(
      screen.getByRole("button", { name: /imprimir documento/i }),
    ).toBeInTheDocument();
  });

  it("exibe PDF em preparação e não mostra imprimir para Word aprovado pendente", () => {
    const onImprimir = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoList
        documentos={[
          {
            ...mockDocumentoAprovado,
            pdfStatus: "PENDENTE",
            pdfUrl: "https://cdn/pdf/pendente.pdf",
          },
        ]}
        onImprimir={onImprimir}
      />,
    );

    expect(screen.getByText(/pdf em preparação/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /imprimir documento/i }),
    ).not.toBeInTheDocument();
  });

  it("exibe estado de carregamento para Word aprovado com PDF gerando", () => {
    render(
      <DocumentoList
        documentos={[
          {
            ...mockDocumentoAprovado,
            pdfStatus: "GERANDO",
          },
        ]}
      />,
    );

    expect(screen.getByText(/preparando pdf/i)).toBeInTheDocument();
  });

  it("mostra imprimir para Word aprovado com PDF pronto", () => {
    const onImprimir = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoList
        documentos={[
          {
            ...mockDocumentoAprovado,
            pdfStatus: "PRONTO",
            pdfUrl: "https://cdn/pdf/pronto.pdf",
          },
        ]}
        onImprimir={onImprimir}
      />,
    );

    expect(
      screen.getByRole("button", { name: /imprimir documento/i }),
    ).toBeInTheDocument();
  });

  it("mostra ação para tentar gerar PDF novamente quando Word aprovado está com erro", async () => {
    const user = userEvent.setup();
    const onRegerarPdf = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoList
        documentos={[
          {
            ...mockDocumentoAprovado,
            pdfStatus: "ERRO",
            pdfError: "Falha no Graph",
          },
        ]}
        canAprovar={true}
        onRegerarPdf={onRegerarPdf}
      />,
    );

    expect(screen.getByText(/falha no pdf/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /tentar gerar pdf novamente/i,
      }),
    );

    expect(onRegerarPdf).toHaveBeenCalledWith("doc-aprovado");
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
    expect(
      screen.getByText("O documento foi impresso com sucesso?"),
    ).toBeInTheDocument();

    // Confirmar a impressao
    await user.click(
      screen.getByRole("button", { name: /sim, foi impresso/i }),
    );

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
      screen.queryByRole("button", {
        name: /editar no word online \(teste\)/i,
      }),
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

    render(<DocumentoList documentos={[mockDocumentoWord]} canEdit={true} />);

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

  it("registra inicio e sucesso ao clicar em Editar no Word", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { url: "ms-word:ofe|u|https://sharepoint/edit" },
      }),
    });

    render(<DocumentoList documentos={[mockDocumentoWord]} canEdit={true} />);

    await user.click(screen.getByRole("button", { name: /^editar no word$/i }));

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "sharepoint_word",
          nivel: "info",
          detalhes: expect.objectContaining({
            acao: "editar",
            status: "inicio",
          }),
        }),
      );
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "sharepoint_word",
          nivel: "info",
          detalhes: expect.objectContaining({
            acao: "editar",
            status: "sucesso",
          }),
        }),
      );
    });
  });

  it("registra falha ao clicar em Editar no Word quando API retorna erro", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: { message: "Falha controlada" },
      }),
    });

    render(<DocumentoList documentos={[mockDocumentoWord]} canEdit={true} />);

    await user.click(screen.getByRole("button", { name: /^editar no word$/i }));

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "sharepoint_word",
          nivel: "error",
          detalhes: expect.objectContaining({
            acao: "editar",
            status: "erro",
          }),
          erro: expect.objectContaining({
            mensagem: expect.any(String),
          }),
        }),
      );
    });
  });

  it("registra sincronizacao Word", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ ok: true });

    render(
      <DocumentoList
        documentos={[
          {
            ...mockDocumentoWord,
            sharepointItemId: "item-1",
            sharepointEditUrl: "https://sharepoint/edit",
          },
        ]}
        canEdit={true}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /sincronizar alterações do word/i }),
    );

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "sharepoint_word",
          nivel: "info",
          detalhes: expect.objectContaining({
            acao: "sincronizar",
            status: "sucesso",
          }),
        }),
      );
    });
  });

  it("registra acao de imprimir ao confirmar impressao", async () => {
    const user = userEvent.setup();
    const onImprimir = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoList
        documentos={[mockDocumentoPdfAprovado]}
        onImprimir={onImprimir}
      />,
    );

    await user.click(screen.getByRole("button", { name: /imprimir/i }));
    await user.click(
      screen.getByRole("button", { name: /sim, foi impresso/i }),
    );

    await waitFor(() => {
      expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: "arquivo_acao",
          nivel: "info",
          arquivo: expect.objectContaining({
            planoId: "plano-1",
            documentoId: "doc-pdf-aprovado",
          }),
          detalhes: expect.objectContaining({
            acao: "imprimir",
            status: "sucesso",
          }),
        }),
      );
    });
  });

  it("abre o PDF de impressão ao visualizar prova Word com PDF pronto", async () => {
    const user = userEvent.setup();
    const abrirJanela = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <DocumentoList
        documentos={[
          {
            ...mockDocumentoWord,
            id: "doc-prova-pdf",
            planoId: "prova-1",
            pdfStatus: "PRONTO",
            pdfUrl: "https://cdn/prova-impressao.pdf",
          },
        ]}
        modulo="prova"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /visualizar documento/i }),
    );

    expect(abrirJanela).toHaveBeenCalledWith(
      "https://cdn/prova-impressao.pdf",
      "_blank",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    abrirJanela.mockRestore();
  });
});
