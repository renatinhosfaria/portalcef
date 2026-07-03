import type { WorkflowModeloDetalhe } from "@essencia/shared/types/workflows";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkflowEditor } from "./workflow-editor";

const mockObterSugestoes = vi.fn();

vi.mock("@/lib/api", () => ({
  obterSugestoes: (...args: unknown[]) => mockObterSugestoes(...args),
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

const modeloExistente: WorkflowModeloDetalhe = {
  id: "modelo-1",
  schoolId: "school-1",
  unitId: "unit-1",
  categoriaId: categoriaEventos.id,
  nome: "Evento Dia dos Pais",
  descricaoCurta: "Protocolo operacional",
  status: "RASCUNHO",
  criadoPor: "gestor-1",
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
  categoria: categoriaEventos,
  orientacoes: [
    { id: "orientacao-1", titulo: "Objetivo", conteudo: "Organizar", ordem: 1 },
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

describe("WorkflowEditor", () => {
  it("permite adicionar fase e etapa sem drag and drop", () => {
    render(
      <WorkflowEditor
        categorias={[]}
        onSalvar={vi.fn()}
        onPublicar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Adicionar fase"));
    expect(screen.getByLabelText("Nome da fase")).toBeTruthy();

    fireEvent.click(screen.getByText("Adicionar etapa"));
    expect(screen.getByLabelText(/Titulo da etapa|Título da etapa/)).toBeTruthy();
  });

  it("salva payload compativel preservando ids de modelo existente", async () => {
    const onSalvar = vi.fn().mockResolvedValue(undefined);

    render(
      <WorkflowEditor
        categorias={[categoriaEventos]}
        modelo={modeloExistente}
        onSalvar={onSalvar}
        onPublicar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
    expect(onSalvar).toHaveBeenCalledWith({
      categoriaId: "categoria-1",
      nome: "Evento Dia dos Pais",
      descricaoCurta: "Protocolo operacional",
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
            },
          ],
        },
      ],
    });
  });

  it("aplica sugestoes da categoria selecionada", async () => {
    mockObterSugestoes.mockResolvedValue({
      orientacoes: [{ titulo: "Objetivo", conteudo: "Organizar evento" }],
      fases: [
        {
          nome: "Preparacao",
          etapas: [{ titulo: "Definir data", instrucao: "Confirmar agenda" }],
        },
      ],
    });

    render(
      <WorkflowEditor
        categorias={[categoriaEventos]}
        onSalvar={vi.fn()}
        onPublicar={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "categoria-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar sugestões" }));

    expect(await screen.findByDisplayValue("Objetivo")).toBeTruthy();
    expect(screen.getByDisplayValue("Definir data")).toBeTruthy();
    expect(mockObterSugestoes).toHaveBeenCalledWith("categoria-1");
  });
});
