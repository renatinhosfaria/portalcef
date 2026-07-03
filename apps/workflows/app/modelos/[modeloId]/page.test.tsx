import type { WorkflowModeloDetalhe } from "@essencia/shared/types/workflows";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EditarModeloPage from "./page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  listarCategorias: vi.fn(),
  buscarModelo: vi.fn(),
  atualizarModelo: vi.fn(),
  publicarModelo: vi.fn(),
  inativarModelo: vi.fn(),
  duplicarModelo: vi.fn(),
  obterSugestoes: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ modeloId: "modelo-1" }),
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/api", () => ({
  listarCategorias: (...args: unknown[]) => mocks.listarCategorias(...args),
  buscarModelo: (...args: unknown[]) => mocks.buscarModelo(...args),
  atualizarModelo: (...args: unknown[]) => mocks.atualizarModelo(...args),
  publicarModelo: (...args: unknown[]) => mocks.publicarModelo(...args),
  inativarModelo: (...args: unknown[]) => mocks.inativarModelo(...args),
  duplicarModelo: (...args: unknown[]) => mocks.duplicarModelo(...args),
  obterSugestoes: (...args: unknown[]) => mocks.obterSugestoes(...args),
}));

const categoriaEventos = {
  id: "categoria-1",
  schoolId: "school-1",
  unitId: "unit-1",
  nome: "Eventos",
  ativo: true,
  ordem: 1,
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
};

function criarModelo(status: WorkflowModeloDetalhe["status"]): WorkflowModeloDetalhe {
  return {
    id: "modelo-1",
    schoolId: "school-1",
    unitId: "unit-1",
    categoriaId: categoriaEventos.id,
    nome: "Evento Dia dos Pais",
    descricaoCurta: "Protocolo operacional",
    status,
    criadoPor: "gestor-1",
    createdAt: "2026-07-03T10:00:00.000Z",
    updatedAt: "2026-07-03T10:00:00.000Z",
    categoria: categoriaEventos,
    orientacoes: [
      {
        id: "orientacao-1",
        titulo: "Objetivo",
        conteudo: "Organizar",
        ordem: 1,
      },
    ],
    fases: [
      {
        id: "fase-1",
        nome: "Preparacao",
        ordem: 1,
        etapas: [
          {
            id: "etapa-1",
            titulo: "Definir data",
            instrucao: "Confirmar no calendario",
            ordem: 1,
            versao: 1,
            updatedAt: "2026-07-03T10:00:00.000Z",
          },
        ],
      },
    ],
  };
}

describe("EditarModeloPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listarCategorias.mockResolvedValue([categoriaEventos]);
    mocks.atualizarModelo.mockResolvedValue(criarModelo("RASCUNHO"));
    mocks.duplicarModelo.mockResolvedValue({ id: "modelo-2" });
  });

  it.each([
    {
      acao: "Publicar",
      mutacao: mocks.publicarModelo,
      statusFinal: "PUBLICADO" as const,
      aviso:
        "Alteracoes em etapas publicadas podem reabrir etapas pendentes nas execucoes abertas.",
    },
    {
      acao: "Inativar",
      mutacao: mocks.inativarModelo,
      statusFinal: "INATIVO" as const,
      aviso: null,
    },
  ])(
    "recarrega detalhe completo depois de $acao retornar resposta parcial",
    async ({ acao, mutacao, statusFinal, aviso }) => {
      mocks.buscarModelo
        .mockResolvedValueOnce(criarModelo("RASCUNHO"))
        .mockResolvedValueOnce(criarModelo(statusFinal));
      mutacao.mockResolvedValue({ id: "modelo-1", status: statusFinal });

      render(<EditarModeloPage />);

      fireEvent.click(await screen.findByRole("button", { name: acao }));

      await waitFor(() => expect(mocks.buscarModelo).toHaveBeenCalledTimes(2));
      expect(mocks.buscarModelo).toHaveBeenLastCalledWith("modelo-1");
      expect(screen.getByLabelText("Nome da fase")).toBeTruthy();

      if (aviso) {
        expect(screen.getByText(aviso)).toBeTruthy();
      }
    },
  );
});
