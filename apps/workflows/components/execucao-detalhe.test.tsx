import type { WorkflowExecucaoDetalhe } from "@essencia/shared/types/workflows";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExecucaoDetalhe } from "./execucao-detalhe";

const execucao: WorkflowExecucaoDetalhe = {
  id: "exec-1",
  schoolId: "school-1",
  unitId: "unit-1",
  modeloId: "modelo-1",
  titulo: "Evento Dia dos Pais",
  status: "EM_ANDAMENTO",
  teste: false,
  iniciadoPor: "user-1",
  concluidoAt: null,
  canceladoAt: null,
  motivoCancelamento: null,
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
  faseAtual: "Preparacao",
  progressoPercentual: 0,
  modeloAtualizado: true,
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
    orientacoes: [
      { id: "ori-1", titulo: "Objetivo", conteudo: "Organizar", ordem: 1 },
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
            instrucao: null,
            ordem: 1,
            versao: 1,
            updatedAt: "2026-07-03T10:00:00.000Z",
          },
        ],
      },
    ],
  },
  progresso: [
    {
      etapaId: "etapa-1",
      concluida: false,
      observacao: null,
      concluidaPor: null,
      concluidaAt: null,
      etapaVersao: 1,
    },
  ],
  anexos: [],
  historico: [],
};

describe("ExecucaoDetalhe", () => {
  it("exibe aviso de modelo atualizado e abas obrigatorias", () => {
    render(
      <ExecucaoDetalhe
        execucao={execucao}
        isGestao={false}
        onAtualizarEtapa={vi.fn()}
        onConcluir={vi.fn()}
        onCancelar={vi.fn()}
        onReabrir={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "Este workflow foi atualizado pela gestao. Revise as etapas pendentes.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Orientacoes")).toBeTruthy();
    expect(screen.getByText("Checklist")).toBeTruthy();
    expect(screen.getByText("Anexos")).toBeTruthy();
    expect(screen.getByText("Historico")).toBeTruthy();
  });
});
