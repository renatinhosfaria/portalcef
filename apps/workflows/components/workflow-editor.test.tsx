import type { WorkflowModeloDetalhe } from "@essencia/shared/types/workflows";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkflowEditor } from "./workflow-editor";

const mockObterSugestoes = vi.fn();
const mockCriarCategoria = vi.fn();

vi.mock("@/lib/api", () => ({
  criarCategoria: (...args: unknown[]) => mockCriarCategoria(...args),
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

const categoriaNova = {
  id: "categoria-nova",
  schoolId: "school-1",
  unitId: "unit-1",
  nome: "Financeiro",
  ativo: true,
  ordem: 2,
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
};

const categoriaInativa = {
  ...categoriaEventos,
  id: "categoria-inativa",
  nome: "Categoria antiga",
  ativo: false,
  ordem: 3,
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

const modeloComEstruturaMultipla: WorkflowModeloDetalhe = {
  ...modeloExistente,
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
        {
          id: "etapa-2",
          titulo: "Reservar espaço",
          instrucao: "Validar disponibilidade",
          ordem: 2,
          versao: 1,
          updatedAt: "2026-07-03T10:00:00.000Z",
        },
      ],
    },
    {
      id: "fase-2",
      nome: "Execucao",
      ordem: 2,
      etapas: [
        {
          id: "etapa-3",
          titulo: "Montar recepção",
          instrucao: "Organizar entrada",
          ordem: 1,
          versao: 1,
          updatedAt: "2026-07-03T10:00:00.000Z",
        },
      ],
    },
  ],
};

describe("WorkflowEditor", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

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

  it("cria categoria inline e seleciona a categoria criada", async () => {
    mockCriarCategoria.mockResolvedValue(categoriaNova);

    render(
      <WorkflowEditor
        categorias={[categoriaEventos]}
        onSalvar={vi.fn()}
        onPublicar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }));
    fireEvent.change(screen.getByLabelText("Nova categoria"), {
      target: { value: "Financeiro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }));

    await waitFor(() =>
      expect(mockCriarCategoria).toHaveBeenCalledWith({ nome: "Financeiro" }),
    );
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Categoria") as HTMLSelectElement).value,
      ).toBe("categoria-nova"),
    );
    expect(screen.getByRole("option", { name: "Financeiro" })).toBeTruthy();
  });

  it("não oferece categoria inativa para um modelo novo", () => {
    render(
      <WorkflowEditor
        categorias={[categoriaEventos, categoriaInativa]}
        onSalvar={vi.fn()}
        onPublicar={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("option", { name: "Categoria antiga" }),
    ).not.toBeInTheDocument();
  });

  it("preserva a categoria inativa já vinculada ao modelo", () => {
    render(
      <WorkflowEditor
        categorias={[categoriaEventos, categoriaInativa]}
        modelo={{
          ...modeloExistente,
          categoriaId: categoriaInativa.id,
          categoria: categoriaInativa,
        }}
        onSalvar={vi.fn()}
        onPublicar={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("option", { name: "Categoria antiga" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria")).toHaveValue(
      categoriaInativa.id,
    );
  });

  it("bloqueia acao secundaria quando ha alteracoes pendentes", async () => {
    const onPublicar = vi.fn();

    render(
      <WorkflowEditor
        categorias={[categoriaEventos]}
        modelo={modeloExistente}
        onSalvar={vi.fn()}
        onPublicar={onPublicar}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Evento Dia dos Pais atualizado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));

    expect(onPublicar).not.toHaveBeenCalled();
    expect(
      screen.getByText("Salve o rascunho antes de executar esta ação."),
    ).toBeTruthy();
  });

  it("bloqueia mutacoes concorrentes durante salvamento e acao secundaria", async () => {
    let resolverSalvar: (() => void) | undefined;
    let resolverPublicar: (() => void) | undefined;
    const onSalvar = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolverSalvar = resolve;
        }),
    );
    const onPublicar = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolverPublicar = resolve;
        }),
    );

    const { rerender } = render(
      <WorkflowEditor
        categorias={[categoriaEventos]}
        modelo={modeloExistente}
        onSalvar={onSalvar}
        onPublicar={onPublicar}
        onInativar={vi.fn()}
        onDuplicar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Inativar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Duplicar" })).toBeDisabled();

    resolverSalvar?.();
    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));

    rerender(
      <WorkflowEditor
        categorias={[categoriaEventos]}
        modelo={modeloExistente}
        onSalvar={vi.fn()}
        onPublicar={onPublicar}
        onInativar={vi.fn()}
        onDuplicar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Inativar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Duplicar" })).toBeDisabled();

    resolverPublicar?.();
    await waitFor(() => expect(onPublicar).toHaveBeenCalledTimes(1));
  });

  it("bloqueia alteracoes estruturais em modelo publicado", () => {
    render(
      <WorkflowEditor
        categorias={[categoriaEventos]}
        modelo={{ ...modeloComEstruturaMultipla, status: "PUBLICADO" }}
        onSalvar={vi.fn()}
        onInativar={vi.fn()}
        onDuplicar={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Aplicar sugestões" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Adicionar fase" })).toBeDisabled();
    screen
      .getAllByRole("button", { name: "Remover fase" })
      .forEach((button) => expect(button).toBeDisabled());
    screen
      .getAllByRole("button", { name: "Adicionar etapa" })
      .forEach((button) => expect(button).toBeDisabled());
    screen
      .getAllByRole("button", { name: "Remover etapa" })
      .forEach((button) => expect(button).toBeDisabled());
    screen
      .getAllByRole("button", { name: "Mover fase para cima" })
      .forEach((button) => expect(button).toBeDisabled());
    screen
      .getAllByRole("button", { name: "Mover fase para baixo" })
      .forEach((button) => expect(button).toBeDisabled());
    screen
      .getAllByRole("button", { name: "Mover etapa para cima" })
      .forEach((button) => expect(button).toBeDisabled());
    screen
      .getAllByRole("button", { name: "Mover etapa para baixo" })
      .forEach((button) => expect(button).toBeDisabled());
  });
});
