import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlanoContent } from "./plano-content";

const mockCriarPlano = vi.fn();
const mockGetPlano = vi.fn();

vi.mock("../../../features/plano-aula", () => ({
  DocumentoUpload: () => <div data-testid="documento-upload" />,
  DocumentoList: () => <div data-testid="documento-list" />,
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
    mockCriarPlano.mockResolvedValue({ id: "plano-1" });
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
});
