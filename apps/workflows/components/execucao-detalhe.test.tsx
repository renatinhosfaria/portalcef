import type { WorkflowExecucaoDetalhe } from "@essencia/shared/types/workflows";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("nao atualiza observacao quando o valor normalizado nao mudou", () => {
    const onAtualizarEtapa = vi.fn();

    render(
      <ExecucaoDetalhe
        execucao={{
          ...execucao,
          progresso: [
            {
              etapaId: "etapa-1",
              concluida: false,
              observacao: "Aguardando agenda",
              concluidaPor: null,
              concluidaAt: null,
              etapaVersao: 1,
            },
          ],
        }}
        isGestao={false}
        onAtualizarEtapa={onAtualizarEtapa}
        onConcluir={vi.fn()}
        onCancelar={vi.fn()}
        onReabrir={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Checklist"));
    fireEvent.blur(screen.getByLabelText("Observação"), {
      target: { value: "  Aguardando agenda  " },
    });

    expect(onAtualizarEtapa).not.toHaveBeenCalled();
  });

  it("edita o título com valor normalizado", async () => {
    const user = userEvent.setup();
    const onEditarTitulo = vi.fn();

    render(
      <ExecucaoDetalhe
        execucao={execucao}
        isGestao={false}
        podeEditarTitulo
        onEditarTitulo={onEditarTitulo}
        onAtualizarEtapa={vi.fn()}
        onConcluir={vi.fn()}
        onCancelar={vi.fn()}
        onReabrir={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Editar título" }));
    const input = screen.getByLabelText("Título da execução");
    await user.clear(input);
    await user.type(input, "  Evento atualizado  ");
    await user.click(screen.getByRole("button", { name: "Salvar título" }));

    await waitFor(() =>
      expect(onEditarTitulo).toHaveBeenCalledWith(
        "exec-1",
        "Evento atualizado",
      ),
    );
  });

  it("valida o tamanho mínimo do título antes de salvar", async () => {
    const user = userEvent.setup();
    const onEditarTitulo = vi.fn();

    render(
      <ExecucaoDetalhe
        execucao={execucao}
        isGestao={false}
        podeEditarTitulo
        onEditarTitulo={onEditarTitulo}
        onAtualizarEtapa={vi.fn()}
        onConcluir={vi.fn()}
        onCancelar={vi.fn()}
        onReabrir={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Editar título" }));
    const input = screen.getByLabelText("Título da execução");
    await user.clear(input);
    await user.type(input, "AB");
    await user.click(screen.getByRole("button", { name: "Salvar título" }));

    expect(
      screen.getByText("Informe um título com pelo menos 3 caracteres."),
    ).toBeInTheDocument();
    expect(onEditarTitulo).not.toHaveBeenCalled();
  });

  it("permite que a gestão descarte uma execução de teste", async () => {
    const user = userEvent.setup();
    const onDescartarTeste = vi.fn();

    render(
      <ExecucaoDetalhe
        execucao={{ ...execucao, teste: true }}
        isGestao
        onDescartarTeste={onDescartarTeste}
        onAtualizarEtapa={vi.fn()}
        onConcluir={vi.fn()}
        onCancelar={vi.fn()}
        onReabrir={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Descartar teste" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmar descarte" }),
    );

    await waitFor(() =>
      expect(onDescartarTeste).toHaveBeenCalledWith("exec-1"),
    );
  });

  it("não oferece descarte quando a execução não é de teste", () => {
    render(
      <ExecucaoDetalhe
        execucao={execucao}
        isGestao
        onDescartarTeste={vi.fn()}
        onAtualizarEtapa={vi.fn()}
        onConcluir={vi.fn()}
        onCancelar={vi.fn()}
        onReabrir={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Descartar teste" }),
    ).not.toBeInTheDocument();
  });
});
