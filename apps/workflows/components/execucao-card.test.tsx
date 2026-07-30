import type { WorkflowExecucaoResumo } from "@essencia/shared/types/workflows";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExecucaoCard } from "./execucao-card";

const execucao: WorkflowExecucaoResumo = {
  id: "execucao-1",
  schoolId: "school-1",
  unitId: "unit-1",
  modeloId: "modelo-1",
  titulo: "Execução teste",
  status: "EM_ANDAMENTO",
  teste: true,
  modeloAtualizado: false,
  iniciadoPor: "gestor-1",
  concluidoAt: null,
  canceladoAt: null,
  motivoCancelamento: null,
  createdAt: "2026-07-30T09:00:00.000Z",
  updatedAt: "2026-07-30T10:00:00.000Z",
  faseAtual: "Preparação",
  progressoPercentual: 25,
  modelo: {
    id: "modelo-1",
    schoolId: "school-1",
    unitId: "unit-1",
    categoriaId: "categoria-1",
    nome: "Evento escolar",
    descricaoCurta: "Protocolo operacional",
    status: "RASCUNHO",
    criadoPor: "gestor-1",
    createdAt: "2026-07-30T08:00:00.000Z",
    updatedAt: "2026-07-30T08:00:00.000Z",
    categoria: {
      id: "categoria-1",
      schoolId: "school-1",
      unitId: "unit-1",
      nome: "Eventos",
      ativo: true,
      ordem: 1,
      createdAt: "2026-07-30T08:00:00.000Z",
      updatedAt: "2026-07-30T08:00:00.000Z",
    },
  },
};

describe("ExecucaoCard", () => {
  it("abre o detalhe da execução", () => {
    render(<ExecucaoCard execucao={execucao} />);

    expect(
      screen.getByRole("link", { name: "Abrir Execução teste" }),
    ).toHaveAttribute("href", "/execucoes/execucao-1");
  });

  it("identifica visualmente uma execução de teste", () => {
    render(<ExecucaoCard execucao={execucao} />);

    expect(screen.getByText("Teste")).toBeInTheDocument();
  });
});
