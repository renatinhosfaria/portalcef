import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as PlanoAulaModulo from "../../../features/plano-aula";

import { PlanoContent } from "./plano-content";

const mocks = vi.hoisted(() => ({
  criarPlano: vi.fn(),
  getPlano: vi.fn(),
  deleteDocumento: vi.fn(),
}));

vi.mock("../../../features/plano-aula", async () => {
  const original = await vi.importActual<
    typeof PlanoAulaModulo
  >("../../../features/plano-aula");

  return {
    ...original,
    DocumentoUpload: () => <div data-testid="documento-upload" />,
    HistoricoTimeline: () => <div data-testid="historico-timeline" />,
    PlanoStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
    usePlanoAula: () => ({
      loading: false,
      criarPlano: mocks.criarPlano,
      getPlano: mocks.getPlano,
      uploadDocumento: vi.fn(),
      addLink: vi.fn(),
      imprimirDocumento: vi.fn(),
      submeterPlano: vi.fn(),
      recuperarPlano: vi.fn(),
      deleteDocumento: mocks.deleteDocumento,
    }),
  };
});

function criarPlanoComDocumento() {
  return {
    id: "plano-1",
    userId: "usuario-1",
    turmaId: "turma-1",
    quinzenaId: "periodo-1",
    status: "RASCUNHO",
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
    unitId: "unidade-1",
    documentos: [
      {
        id: "documento-1",
        planoId: "plano-1",
        tipo: "ARQUIVO",
        fileName: "plano.pdf",
        mimeType: "application/pdf",
        url: "https://arquivos.exemplo/plano.pdf",
        createdAt: "2026-09-08T00:00:00.000Z",
      },
    ],
    user: { id: "usuario-1", name: "Professora" },
    turma: { id: "turma-1", name: "Turma 1", code: "T1" },
  };
}

describe("PlanoContent - integração da exclusão de documento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.criarPlano.mockResolvedValue({ id: "plano-1" });
    mocks.getPlano
      .mockResolvedValueOnce(criarPlanoComDocumento())
      .mockRejectedValueOnce(new Error("Falha de conexão"));
    mocks.deleteDocumento.mockResolvedValue(undefined);
  });

  it("fecha o diálogo e avisa quando exclui, mas não consegue atualizar a lista", async () => {
    render(
      <PlanoContent
        periodoId="periodo-1"
        turmaId="turma-1"
        userId="usuario-1"
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /excluir documento/i }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /confirmar exclusão do arquivo/i,
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Arquivo duplicado no plano de aula" },
    });
    fireEvent.click(screen.getByRole("button", { name: /excluir arquivo/i }));

    await waitFor(() => {
      expect(mocks.deleteDocumento).toHaveBeenCalledWith(
        "plano-1",
        "documento-1",
        "Arquivo duplicado no plano de aula",
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: /confirmar exclusão do arquivo/i,
        }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "O arquivo foi excluído, mas não foi possível atualizar a lista agora. Atualize a página para conferir.",
      ),
    ).toBeInTheDocument();
    expect(mocks.deleteDocumento).toHaveBeenCalledTimes(1);
  });
});
