import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProvaDetailContent } from "./prova-content";

const criarProva = vi.fn();
const getProva = vi.fn();
const deleteDocumento = vi.fn();
const refetch = vi.fn();

let documentoListProps: {
  canDelete?: boolean;
  onDelete?: (documentoId: string, motivo: string) => Promise<void>;
} | null = null;

const prova = {
  id: "prova-1",
  userId: "usuario-1",
  turmaId: "turma-1",
  unitId: "unidade-1",
  provaCicloId: "ciclo-1",
  status: "RASCUNHO",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  documentos: [],
  user: { id: "usuario-1", name: "Professora" },
  turma: { id: "turma-1", name: "Turma 1", code: "T1" },
};

vi.mock("../../../features/prova", () => ({
  adaptarDocumentoProvaParaDocumentoList: (documento: unknown) => documento,
  useProva: () => ({
    loading: false,
    criarProva,
    getProva,
    uploadDocumento: vi.fn(),
    addLink: vi.fn(),
    imprimirDocumento: vi.fn(),
    deleteDocumento,
    enviarParaImpressao: vi.fn(),
    recuperarProva: vi.fn(),
    enviarParaAnalise: vi.fn(),
    reenviarParaAnalise: vi.fn(),
  }),
}));

vi.mock("../../../features/plano-aula", () => ({
  DocumentoUpload: () => <div>Upload de documento</div>,
  DocumentoList: (props: typeof documentoListProps) => {
    documentoListProps = props;
    return <div>Lista de documentos</div>;
  },
  HistoricoTimeline: () => <div>Histórico</div>,
}));

vi.mock("../../../features/prova/types", () => ({
  PROVA_STATUS_LABELS: { RASCUNHO: "Rascunho" },
  PROVA_STATUS_COLORS: { RASCUNHO: "" },
}));

describe("ProvaDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentoListProps = null;
    criarProva.mockResolvedValue({ id: "prova-1" });
    getProva.mockResolvedValue(prova);
    deleteDocumento.mockResolvedValue(undefined);
    refetch.mockResolvedValue(undefined);
  });

  it("exclui documento com motivo, recarrega a prova e atualiza o histórico", async () => {
    render(
      <ProvaDetailContent
        cicloId="ciclo-1"
        turmaId="turma-1"
        userId="usuario-1"
      />,
    );

    await waitFor(() => {
      expect(documentoListProps?.canDelete).toBe(true);
      expect(documentoListProps?.onDelete).toEqual(expect.any(Function));
    });

    await act(async () => {
      await documentoListProps?.onDelete?.(
        "documento-1",
        "Arquivo enviado com conteúdo incorreto",
      );
    });

    expect(deleteDocumento).toHaveBeenCalledWith(
      "prova-1",
      "documento-1",
      "Arquivo enviado com conteúdo incorreto",
    );
    expect(getProva).toHaveBeenCalledTimes(2);
  });

  it("propaga erro amigável quando a exclusão falha", async () => {
    deleteDocumento.mockRejectedValueOnce({
      response: { status: 403 },
    });

    render(
      <ProvaDetailContent
        cicloId="ciclo-1"
        turmaId="turma-1"
        userId="usuario-1"
      />,
    );

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

  it("informa erro claro quando a lista da prova não pode ser atualizada após a exclusão", async () => {
    getProva.mockReset();
    getProva
      .mockResolvedValueOnce(prova)
      .mockRejectedValueOnce(new Error("Failed to fetch"));

    render(
      <ProvaDetailContent
        cicloId="ciclo-1"
        turmaId="turma-1"
        userId="usuario-1"
      />,
    );

    await waitFor(() => {
      expect(documentoListProps?.onDelete).toEqual(expect.any(Function));
    });

    await act(async () => {
      await documentoListProps?.onDelete?.(
        "documento-1",
        "Arquivo enviado com conteúdo incorreto",
      );
    });

    expect(
      await screen.findByText(
        "O arquivo foi excluído, mas não foi possível atualizar a lista agora. Atualize a página para conferir.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Arquivo excluído com sucesso.")).toBeNull();
  });
});
