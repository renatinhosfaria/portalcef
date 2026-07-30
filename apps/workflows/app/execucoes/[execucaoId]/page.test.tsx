import type { WorkflowExecucaoDetalhe } from "@essencia/shared/types/workflows";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecucaoDetalhe } from "@/components/execucao-detalhe";

import ExecucaoPage from "./page";

const mockUseParams = vi.fn();
const mockUseTenant = vi.fn();
const mockBuscarExecucao = vi.fn();
const mockAtualizarEtapa = vi.fn();
const mockEditarTituloExecucao = vi.fn();
const mockDescartarExecucaoTeste = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock("@/lib/api", () => ({
  atualizarEtapa: (...args: unknown[]) => mockAtualizarEtapa(...args),
  buscarExecucao: (...args: unknown[]) => mockBuscarExecucao(...args),
  editarTituloExecucao: (...args: unknown[]) =>
    mockEditarTituloExecucao(...args),
  descartarExecucaoTeste: (...args: unknown[]) =>
    mockDescartarExecucaoTeste(...args),
  cancelarExecucao: vi.fn(),
  concluirExecucao: vi.fn(),
  enviarAnexoExecucao: vi.fn(),
  reabrirExecucao: vi.fn(),
  removerAnexoExecucao: vi.fn(),
}));

vi.mock("@/components/execucao-detalhe", () => ({
  ExecucaoDetalhe: (props: ComponentProps<typeof ExecucaoDetalhe>) => (
    <>
      <button
        type="button"
        onClick={() => {
          void Promise.resolve(
            props.onAtualizarEtapa("exec-1", "etapa-1", {
              concluida: true,
            }),
          ).catch(() => undefined);
          void Promise.resolve(
            props.onAtualizarEtapa("exec-1", "etapa-1", {
              concluida: false,
            }),
          ).catch(() => undefined);
        }}
      >
        Disparar mutações
      </button>
      <button
        type="button"
        onClick={() =>
          void Promise.resolve(
            props.onEditarTitulo?.("exec-1", "Título atualizado"),
          ).catch(() => undefined)
        }
      >
        Editar título mock
      </button>
      <button
        type="button"
        onClick={() =>
          void Promise.resolve(
            props.onDescartarTeste?.("exec-1"),
          ).catch(() => undefined)
        }
      >
        Descartar teste mock
      </button>
    </>
  ),
}));

const execucao: WorkflowExecucaoDetalhe = {
  id: "exec-1",
  schoolId: "school-1",
  unitId: "unit-1",
  modeloId: "modelo-1",
  titulo: "Evento Dia dos Pais",
  status: "EM_ANDAMENTO",
  teste: false,
  modeloAtualizado: false,
  iniciadoPor: "user-1",
  concluidoAt: null,
  canceladoAt: null,
  motivoCancelamento: null,
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
  modelo: {
    id: "modelo-1",
    schoolId: "school-1",
    unitId: "unit-1",
    categoriaId: "categoria-1",
    nome: "Evento",
    descricaoCurta: "Evento escolar",
    status: "PUBLICADO",
    criadoPor: "user-1",
    createdAt: "2026-07-03T10:00:00.000Z",
    updatedAt: "2026-07-03T10:00:00.000Z",
    categoria: {
      id: "categoria-1",
      schoolId: "school-1",
      unitId: "unit-1",
      nome: "Eventos",
      ativo: true,
      ordem: 1,
      createdAt: "2026-07-03T10:00:00.000Z",
      updatedAt: "2026-07-03T10:00:00.000Z",
    },
    orientacoes: [],
    fases: [],
  },
  faseAtual: null,
  progressoPercentual: 0,
  progresso: [],
  anexos: [],
  historico: [],
};

describe("ExecucaoPage", () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ execucaoId: "exec-1" });
    mockUseTenant.mockReturnValue({
      role: "professora",
      userId: "user-1",
      isLoaded: true,
    });
    mockBuscarExecucao.mockResolvedValue(execucao);
    mockAtualizarEtapa.mockReturnValue(new Promise(() => undefined));
    mockEditarTituloExecucao.mockResolvedValue(execucao);
    mockDescartarExecucaoTeste.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("nao executa duas mutacoes simultaneas", async () => {
    const user = userEvent.setup();

    render(<ExecucaoPage />);

    await user.click(await screen.findByText("Disparar mutações"));

    await waitFor(() => expect(mockAtualizarEtapa).toHaveBeenCalledTimes(1));
  });

  it("conecta a edição de título ao cliente HTTP", async () => {
    const user = userEvent.setup();

    render(<ExecucaoPage />);

    await user.click(await screen.findByText("Editar título mock"));

    await waitFor(() =>
      expect(mockEditarTituloExecucao).toHaveBeenCalledWith("exec-1", {
        titulo: "Título atualizado",
      }),
    );
  });

  it("descarta o teste e volta para a página principal", async () => {
    const user = userEvent.setup();
    mockUseTenant.mockReturnValue({
      role: "coordenadora_geral",
      userId: "gestor-1",
      isLoaded: true,
    });
    mockBuscarExecucao.mockResolvedValue({ ...execucao, teste: true });

    render(<ExecucaoPage />);

    await user.click(await screen.findByText("Descartar teste mock"));

    await waitFor(() =>
      expect(mockDescartarExecucaoTeste).toHaveBeenCalledWith("exec-1"),
    );
    expect(mockPush).toHaveBeenCalledWith("/");
  });
});
