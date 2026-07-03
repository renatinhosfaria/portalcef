import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RevisaoRelatorioContent } from "./revisao-content";

const routerPush = vi.fn();
const getRelatorio = vi.fn();
const editarWord = vi.fn();
const sincronizarWord = vi.fn();
const aprovar = vi.fn();
const devolver = vi.fn();
const aprovarDocumento = vi.fn();
const desaprovarDocumento = vi.fn();

let relatorioHeaderProps: {
  professorName: string;
  turmaName: string;
  turmaCode?: string;
  semestreNumero?: number;
  semestreDescricao?: string | null;
  semestreInicio?: string;
  semestreFim?: string;
  prazoEntrega?: string;
  etapaNome?: string;
  status: string;
  submittedAt?: string | null;
} | null = null;

let historicoTimelineProps: {
  planoId: string;
  modulo?: "plano-aula" | "prova" | "relatorio";
} | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("../../../../features/relatorio", () => ({
  STATUS_LABELS: {
    AGUARDANDO_ANALISTA: "Aguardando Analista",
  },
  RelatorioHeader: (props: typeof relatorioHeaderProps) => {
    relatorioHeaderProps = props;
    return <div>Capa do relatório: {props?.semestreDescricao}</div>;
  },
  useAnalistaRelatorio: () => ({
    loading: false,
    aprovar,
    devolver,
    aprovarDocumento,
    desaprovarDocumento,
  }),
  useRelatorio: () => ({
    getRelatorio,
    editarWord,
    sincronizarWord,
  }),
  useSemestreRelatorio: () => ({
    semestres: [
      {
        id: "semestre-1",
        unidadeId: "unidade-1",
        etapa: "INFANTIL",
        anoLetivo: 2026,
        semestre: 1,
        descricao: "Relatório Infantil",
        dataInicio: "2026-02-01",
        dataFim: "2026-06-30",
        dataMaximaEntrega: "2026-06-20",
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    buscarPorTurma: vi.fn(),
    criarSemestre: vi.fn(),
    editarSemestre: vi.fn(),
    excluirSemestre: vi.fn(),
  }),
}));

vi.mock("../../../../features/plano-aula", () => ({
  HistoricoTimeline: (props: typeof historicoTimelineProps) => {
    historicoTimelineProps = props;
    return <div>Histórico do relatório</div>;
  },
}));

describe("RevisaoRelatorioContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    relatorioHeaderProps = null;
    historicoTimelineProps = null;
    getRelatorio.mockResolvedValue({
      id: "relatorio-1",
      userId: "prof-1",
      turmaId: "turma-1",
      unitId: "unidade-1",
      semestreId: "semestre-1",
      semestreRelatorioId: "semestre-1",
      status: "AGUARDANDO_ANALISTA",
      submittedAt: "2026-06-30T09:44:00.000Z",
      createdAt: "2026-06-29T09:44:00.000Z",
      updatedAt: "2026-06-30T09:44:00.000Z",
      documentos: [],
      user: { id: "prof-1", name: "Patrícia Kelly" },
      turma: {
        id: "turma-1",
        name: "Infantil 2",
        code: "INF-2-M",
        stageId: "etapa-1",
      },
      professorName: "Professora Fallback",
      turmaName: "Turma Fallback",
      turmaCode: "Fallback",
      stageId: "etapa-1",
      deadline: "2026-06-25",
    });
  });

  it("exibe a capa do relatório e o histórico de movimentações", async () => {
    render(<RevisaoRelatorioContent relatorioId="relatorio-1" />);

    await waitFor(() => {
      expect(getRelatorio).toHaveBeenCalledWith("relatorio-1");
    });

    expect(screen.getByText("Capa do relatório: Relatório Infantil")).toBeInTheDocument();
    expect(screen.getByText("Histórico do relatório")).toBeInTheDocument();
    expect(relatorioHeaderProps).toEqual(
      expect.objectContaining({
        professorName: "Patrícia Kelly",
        turmaName: "Infantil 2",
        turmaCode: "INF-2-M",
        semestreNumero: 1,
        semestreDescricao: "Relatório Infantil",
        semestreInicio: "2026-02-01",
        semestreFim: "2026-06-30",
        prazoEntrega: "2026-06-20",
        etapaNome: "Infantil",
        status: "AGUARDANDO_ANALISTA",
        submittedAt: "2026-06-30T09:44:00.000Z",
      }),
    );
    expect(historicoTimelineProps).toEqual(
      expect.objectContaining({
        planoId: "relatorio-1",
        modulo: "relatorio",
      }),
    );
  });
});
