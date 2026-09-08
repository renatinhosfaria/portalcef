import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RevisaoProvaContent } from "./revisao-content";

const routerPush = vi.fn();
const fetchProva = vi.fn();
const refetch = vi.fn();
const aprovar = vi.fn();
const devolver = vi.fn();
const uploadDocumento = vi.fn();
const addLink = vi.fn();
const aprovarDocumento = vi.fn();
const desaprovarDocumento = vi.fn();
const imprimirDocumento = vi.fn();
const regerarPdfDocumento = vi.fn();
const deleteDocumento = vi.fn();

let documentoListProps: {
  onRegerarPdf?: (documentoId: string) => Promise<void>;
  canAprovar?: boolean;
  canEdit?: boolean;
  canComentar?: boolean;
  canDelete?: boolean;
  onDelete?: (documentoId: string, motivo: string) => Promise<void>;
} | null = null;

let historicoTimelineProps: {
  planoId: string;
  modulo?: "plano-aula" | "prova";
} | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("../../../../features/prova", () => ({
  ProvaHeader: () => <div>Cabecalho da prova</div>,
  adaptarDocumentoProvaParaDocumentoList: (documento: {
    provaId: string;
    pdfUrl?: string;
  }) => ({
    ...documento,
    planoId: documento.provaId,
    pdfStatus: documento.pdfUrl ? "PRONTO" : "ERRO",
  }),
  useAnalistaProvaActions: () => ({
    loading: false,
    aprovar,
    devolver,
  }),
  useProva: () => ({
    uploadDocumento,
    addLink,
    aprovarDocumento,
    desaprovarDocumento,
    imprimirDocumento,
    regerarPdfDocumento,
    deleteDocumento,
  }),
  useProvaDetalhe: () => ({
    loading: false,
    error: null,
    fetchProva,
    refetch,
    prova: {
      id: "prova-1",
      userId: "prof-1",
      turmaId: "turma-1",
      unitId: "unidade-1",
      provaCicloId: "ciclo-1",
      status: "AGUARDANDO_ANALISTA",
      submittedAt: "2026-06-10T12:00:00.000Z",
      createdAt: "2026-06-09T12:00:00.000Z",
      updatedAt: "2026-06-10T12:00:00.000Z",
      user: { id: "prof-1", name: "Maria Silva" },
      turma: {
        id: "turma-1",
        name: "1º Ano A",
        code: "1A",
        stageId: "etapa-1",
      },
      documentos: [
        {
          id: "doc-1",
          provaId: "prova-1",
          tipo: "ARQUIVO",
          fileName: "prova.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          url: "https://cdn/prova.docx",
          createdAt: "2026-06-10T12:00:00.000Z",
        },
      ],
    },
  }),
}));

vi.mock("../../../../features/plano-aula", () => ({
  DocumentoList: (props: {
    onRegerarPdf?: (documentoId: string) => Promise<void>;
    canAprovar?: boolean;
    canEdit?: boolean;
    canComentar?: boolean;
    canDelete?: boolean;
    onDelete?: (documentoId: string, motivo: string) => Promise<void>;
  }) => {
    documentoListProps = props;
    return <div>Lista de documentos</div>;
  },
  DocumentoUpload: () => <div>Upload de documento</div>,
  HistoricoTimeline: (props: {
    planoId: string;
    modulo?: "plano-aula" | "prova";
  }) => {
    historicoTimelineProps = props;
    return <div>Historico da prova</div>;
  },
}));

vi.mock("../../../analise/[planoId]/tarefa-form", () => ({
  TarefaForm: ({
    initialContexts,
  }: {
    initialContexts?: { provaId?: string };
  }) => <div>Formulario tarefa prova: {initialContexts?.provaId}</div>,
}));

describe("RevisaoProvaContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentoListProps = null;
    historicoTimelineProps = null;
    fetchProva.mockResolvedValue(undefined);
    refetch.mockResolvedValue(undefined);
    regerarPdfDocumento.mockResolvedValue(undefined);
    deleteDocumento.mockResolvedValue(undefined);
  });

  it("espelha a análise de plano com tarefa vinculada e regeração de PDF", async () => {
    render(<RevisaoProvaContent provaId="prova-1" />);

    await waitFor(() => {
      expect(fetchProva).toHaveBeenCalledWith("prova-1");
    });

    expect(screen.getByText("Cabecalho da prova")).toBeInTheDocument();
    expect(screen.getByText("Historico da prova")).toBeInTheDocument();
    expect(historicoTimelineProps).toEqual(
      expect.objectContaining({
        planoId: "prova-1",
        modulo: "prova",
      }),
    );
    expect(
      screen.getByRole("button", { name: /criar tarefa vinculada à prova/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Formulario tarefa prova: prova-1/i),
    ).toBeInTheDocument();
    expect(documentoListProps).toEqual(
      expect.objectContaining({
        canAprovar: true,
        canEdit: true,
        canComentar: true,
        canDelete: true,
        onRegerarPdf: expect.any(Function),
        onDelete: expect.any(Function),
      }),
    );

    await act(async () => {
      await documentoListProps?.onDelete?.(
        "doc-1",
        "Arquivo enviado com conteúdo incorreto",
      );
    });

    expect(deleteDocumento).toHaveBeenCalledWith(
      "prova-1",
      "doc-1",
      "Arquivo enviado com conteúdo incorreto",
    );
    expect(refetch).toHaveBeenCalled();
  });

  it("limpa o sucesso anterior quando a atualização falha após nova exclusão", async () => {
    refetch
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Falha de conexão"));

    render(<RevisaoProvaContent provaId="prova-1" />);

    await waitFor(() => {
      expect(documentoListProps?.onDelete).toEqual(expect.any(Function));
    });

    await act(async () => {
      await documentoListProps?.onDelete?.(
        "doc-1",
        "Arquivo enviado com conteúdo incorreto",
      );
    });
    expect(
      screen.getByText("Arquivo excluído com sucesso!"),
    ).toBeInTheDocument();

    await act(async () => {
      await documentoListProps?.onDelete?.(
        "doc-2",
        "Arquivo enviado com conteúdo incorreto",
      );
    });

    expect(screen.queryByText("Arquivo excluído com sucesso!")).toBeNull();
    expect(
      screen.getByText(
        "O arquivo foi excluído, mas não foi possível atualizar a lista agora. Atualize a página para conferir.",
      ),
    ).toBeInTheDocument();
  });
});
