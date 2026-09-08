import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlanoContent } from "./plano-content";

const mockCriarPlano = vi.fn();
const mockGetPlano = vi.fn();
const mockDeleteDocumento = vi.fn();

let documentoListProps: {
  canDelete?: boolean;
  onDelete?: (documentoId: string, motivo: string) => Promise<void>;
} | null = null;

vi.mock("../../../features/plano-aula", () => ({
  DocumentoUpload: () => <div data-testid="documento-upload" />,
  DocumentoList: (props: typeof documentoListProps) => {
    documentoListProps = props;
    return <div data-testid="documento-list" />;
  },
  HistoricoTimeline: () => <div data-testid="historico-timeline" />,
  PlanoStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  usePlanoAula: () => ({
    loading: false,
    criarPlano: mockCriarPlano,
    getPlano: mockGetPlano,
    uploadDocumento: vi.fn(),
    addLink: vi.fn(),
    imprimirDocumento: vi.fn(),
    submeterPlano: vi.fn(),
    recuperarPlano: vi.fn(),
    deleteDocumento: mockDeleteDocumento,
  }),
}));

function criarPlanoAguardandoAnalista(documentos: unknown[] = []) {
  return {
    id: "plano-1",
    userId: "usuario-1",
    turmaId: "turma-1",
    quinzenaId: "periodo-1",
    status: "AGUARDANDO_ANALISTA",
    createdAt: "2026-05-28T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z",
    unitId: "unidade-1",
    documentos,
    user: { id: "usuario-1", name: "Professora" },
    turma: { id: "turma-1", name: "Turma 1", code: "T1" },
  };
}

describe("PlanoContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentoListProps = null;
    mockCriarPlano.mockResolvedValue({ id: "plano-1" });
    mockDeleteDocumento.mockResolvedValue(undefined);
  });

  it("não mostra Recuperar Plano quando já existe documento aprovado", async () => {
    mockGetPlano.mockResolvedValue(
      criarPlanoAguardandoAnalista([
        {
          id: "documento-1",
          planoId: "plano-1",
          tipo: "ARQUIVO",
          fileName: "plano.docx",
          createdAt: "2026-05-28T00:00:00.000Z",
          approvedBy: "analista-1",
        },
      ]),
    );

    render(
      <PlanoContent
        periodoId="periodo-1"
        turmaId="turma-1"
        userId="usuario-1"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Carregando plano de aula...")).toBeNull();
    });

    expect(
      screen.queryByRole("button", { name: /recuperar plano/i }),
    ).toBeNull();
  });

  it("não mostra Recuperar Plano quando já existe comentário da análise", async () => {
    mockGetPlano.mockResolvedValue(
      criarPlanoAguardandoAnalista([
        {
          id: "documento-1",
          planoId: "plano-1",
          tipo: "ARQUIVO",
          fileName: "plano.docx",
          createdAt: "2026-05-28T00:00:00.000Z",
          comentarios: [{ id: "comentario-1" }],
        },
      ]),
    );

    render(
      <PlanoContent
        periodoId="periodo-1"
        turmaId="turma-1"
        userId="usuario-1"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Carregando plano de aula...")).toBeNull();
    });

    expect(
      screen.queryByRole("button", { name: /recuperar plano/i }),
    ).toBeNull();
  });

  it("exclui documento com motivo e atualiza o plano sem recarregar a página", async () => {
    mockGetPlano.mockResolvedValue(
      criarPlanoAguardandoAnalista([
        {
          id: "documento-1",
          planoId: "plano-1",
          tipo: "ARQUIVO",
          fileName: "plano.docx",
          createdAt: "2026-05-28T00:00:00.000Z",
        },
      ]),
    );

    render(
      <PlanoContent
        periodoId="periodo-1"
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

    expect(mockDeleteDocumento).toHaveBeenCalledWith(
      "plano-1",
      "documento-1",
      "Arquivo enviado com conteúdo incorreto",
    );
    expect(mockGetPlano).toHaveBeenCalledTimes(2);
  });

  it("informa erro claro quando a lista do plano não pode ser atualizada após a exclusão", async () => {
    mockGetPlano.mockReset();
    mockGetPlano
      .mockResolvedValueOnce(criarPlanoAguardandoAnalista([]))
      .mockRejectedValueOnce(new Error("Failed to fetch"));

    render(
      <PlanoContent
        periodoId="periodo-1"
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
        "Arquivo removido por estar desatualizado",
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
