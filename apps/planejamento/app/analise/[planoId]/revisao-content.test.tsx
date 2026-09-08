import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RevisaoContent } from "./revisao-content";

const fetchPlano = vi.fn();
const refetch = vi.fn();
const deleteDocumento = vi.fn();

let documentoListProps: {
  canDelete?: boolean;
  onDelete?: (documentoId: string, motivo: string) => Promise<void>;
} | null = null;

const plano = {
  id: "plano-1",
  userId: "prof-1",
  turmaId: "turma-1",
  quinzenaId: "periodo-1",
  status: "AGUARDANDO_ANALISTA",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  documentos: [],
  user: { id: "prof-1", name: "Professora" },
  turma: { id: "turma-1", name: "Turma 1", code: "T1", stageId: "etapa-1" },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../../../features/plano-aula", () => ({
  DocumentoUpload: () => <div>Upload de documento</div>,
  DocumentoList: (props: typeof documentoListProps) => {
    documentoListProps = props;
    return <div>Lista de documentos</div>;
  },
  HistoricoTimeline: () => <div>Histórico</div>,
  PlanoHeader: () => <div>Cabeçalho</div>,
  useAnalistaActions: () => ({
    loading: false,
    aprovar: vi.fn(),
    devolver: vi.fn(),
  }),
  usePeriodoData: () => ({
    periodo: null,
    etapaNome: undefined,
    isLoading: false,
  }),
  usePlanoAula: () => ({
    uploadDocumento: vi.fn(),
    addLink: vi.fn(),
    aprovarDocumento: vi.fn(),
    desaprovarDocumento: vi.fn(),
    deleteDocumento,
    regerarPdfDocumento: vi.fn(),
    imprimirDocumento: vi.fn(),
  }),
  usePlanoDetalhe: () => ({
    loading: false,
    plano,
    error: null,
    fetchPlano,
    refetch,
  }),
}));

vi.mock("./tarefa-form", () => ({
  TarefaForm: () => <div>Formulário de tarefa</div>,
}));

describe("RevisaoContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentoListProps = null;
    fetchPlano.mockResolvedValue(undefined);
    refetch.mockResolvedValue(undefined);
    deleteDocumento.mockResolvedValue(undefined);
  });

  it("exclui documento com motivo, recarrega o plano e atualiza o histórico", async () => {
    render(<RevisaoContent planoId="plano-1" />);

    await waitFor(() => {
      expect(fetchPlano).toHaveBeenCalledWith("plano-1");
      expect(documentoListProps?.onDelete).toEqual(expect.any(Function));
    });

    await act(async () => {
      await documentoListProps?.onDelete?.(
        "documento-1",
        "Arquivo enviado com conteúdo incorreto",
      );
    });

    expect(deleteDocumento).toHaveBeenCalledWith(
      "plano-1",
      "documento-1",
      "Arquivo enviado com conteúdo incorreto",
    );
    expect(refetch).toHaveBeenCalled();
  });

  it("propaga erro amigável quando a exclusão falha", async () => {
    deleteDocumento.mockRejectedValueOnce({ response: { status: 403 } });

    render(<RevisaoContent planoId="plano-1" />);

    await waitFor(() => {
      expect(documentoListProps?.onDelete).toEqual(expect.any(Function));
    });

    await act(async () => {
      await expect(
        documentoListProps?.onDelete?.(
          "documento-1",
          "Arquivo enviado com conteúdo incorreto",
        ),
      ).rejects.toEqual({ response: { status: 403 } });
    });

    expect(
      await screen.findByText("Você não tem permissão para fazer essa ação."),
    ).toBeInTheDocument();
  });
});
