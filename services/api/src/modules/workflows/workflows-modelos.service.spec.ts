import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  eq,
  workflowEtapaProgresso,
  workflowEtapas,
  workflowExecucoes,
  workflowFases,
  workflowModelos,
  workflowOrientacoes,
} from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import { WorkflowsModelosService } from "./workflows-modelos.service";
import type { WorkflowUserContext } from "./workflows.types";

const tx = {
  insert: jest.fn(),
  values: jest.fn(),
  returning: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  where: jest.fn(),
};

const db = {
  query: {
    workflowCategorias: { findFirst: jest.fn() },
    workflowModelos: { findFirst: jest.fn(), findMany: jest.fn() },
    workflowExecucoes: { findMany: jest.fn() },
  },
  transaction: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  where: jest.fn(),
  returning: jest.fn(),
};

jest.mock("@essencia/db", () => ({
  and: jest.fn((...condicoes: unknown[]) => ({ operador: "and", condicoes })),
  asc: jest.fn((campo: unknown) => ({ operador: "asc", campo })),
  desc: jest.fn((campo: unknown) => ({ operador: "desc", campo })),
  eq: jest.fn((campo: unknown, valor: unknown) => ({
    operador: "eq",
    campo,
    valor,
  })),
  ilike: jest.fn((campo: unknown, valor: unknown) => ({
    operador: "ilike",
    campo,
    valor,
  })),
  inArray: jest.fn((campo: unknown, valores: unknown[]) => ({
    operador: "inArray",
    campo,
    valores,
  })),
  workflowCategorias: {
    id: "workflowCategorias.id",
    schoolId: "workflowCategorias.schoolId",
    unitId: "workflowCategorias.unitId",
  },
  workflowEtapaProgresso: {
    etapaId: "workflowEtapaProgresso.etapaId",
    execucaoId: "workflowEtapaProgresso.execucaoId",
  },
  workflowEtapas: {
    id: "workflowEtapas.id",
    faseId: "workflowEtapas.faseId",
    ordem: "workflowEtapas.ordem",
  },
  workflowExecucoes: {
    id: "workflowExecucoes.id",
    modeloId: "workflowExecucoes.modeloId",
    schoolId: "workflowExecucoes.schoolId",
    unitId: "workflowExecucoes.unitId",
    status: "workflowExecucoes.status",
  },
  workflowFases: {
    id: "workflowFases.id",
    modeloId: "workflowFases.modeloId",
    ordem: "workflowFases.ordem",
  },
  workflowModelos: {
    id: "workflowModelos.id",
    schoolId: "workflowModelos.schoolId",
    unitId: "workflowModelos.unitId",
    categoriaId: "workflowModelos.categoriaId",
    nome: "workflowModelos.nome",
    status: "workflowModelos.status",
  },
  workflowOrientacoes: {
    id: "workflowOrientacoes.id",
    modeloId: "workflowOrientacoes.modeloId",
    ordem: "workflowOrientacoes.ordem",
  },
}));

const databaseService = { db };
const historicoService = { registrar: jest.fn() };
const mockEq = eq as unknown as jest.Mock;

const gestao: WorkflowUserContext = {
  userId: "gestor-1",
  role: "coordenadora_geral",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: null,
};

const dtoModelo = {
  categoriaId: "cat-1",
  nome: "Evento Dia dos Pais",
  descricaoCurta: "Fluxo do evento",
  orientacoes: [{ titulo: "Objetivo", conteudo: "Organizar", ordem: 1 }],
  fases: [
    {
      nome: "Preparacao",
      ordem: 1,
      etapas: [{ titulo: "Definir data", instrucao: null, ordem: 1 }],
    },
  ],
};

const modeloPublicado = {
  id: "modelo-1",
  categoriaId: "cat-1",
  nome: "Evento Dia dos Pais",
  descricaoCurta: "Fluxo do evento",
  status: "PUBLICADO",
  schoolId: "school-1",
  unitId: "unit-1",
  criadoPor: "gestor-1",
  orientacoes: [],
  fases: [
    {
      id: "fase-1",
      nome: "Preparacao",
      ordem: 1,
      etapas: [
        {
          id: "etapa-1",
          titulo: "Antigo",
          instrucao: null,
          ordem: 1,
          versao: 2,
        },
      ],
    },
  ],
};

function configurarCadeias() {
  tx.insert.mockReturnValue(tx);
  tx.values.mockReturnValue(tx);
  tx.delete.mockReturnValue(tx);
  tx.update.mockReturnValue(tx);
  tx.set.mockReturnValue(tx);
  tx.where.mockReturnValue(tx);
  db.update.mockReturnValue(db);
  db.set.mockReturnValue(db);
  db.where.mockReturnValue(db);
  db.transaction.mockImplementation(async (cb: (txParam: typeof tx) => unknown) =>
    cb(tx),
  );
}

describe("WorkflowsModelosService", () => {
  let service: WorkflowsModelosService;

  beforeEach(async () => {
    configurarCadeias();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsModelosService,
        { provide: DatabaseService, useValue: databaseService },
        { provide: WorkflowsHistoricoService, useValue: historicoService },
      ],
    }).compile();

    service = module.get(WorkflowsModelosService);
    jest.clearAllMocks();
    tx.returning.mockReset();
    db.returning.mockReset();
    db.query.workflowCategorias.findFirst.mockReset();
    db.query.workflowModelos.findFirst.mockReset();
    db.query.workflowModelos.findMany.mockReset();
    db.query.workflowExecucoes.findMany.mockReset();
    historicoService.registrar.mockReset();
  });

  it("exige unidade na sessao", async () => {
    await expect(
      service.listar({ ...gestao, unitId: null }, { status: "PUBLICADO" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("bloqueia criacao por usuario comum", async () => {
    await expect(
      service.criar({ ...gestao, role: "professora" }, dtoModelo),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("bloqueia categoria de outra unidade", async () => {
    db.query.workflowCategorias.findFirst.mockResolvedValue(null);

    await expect(service.criar(gestao, dtoModelo)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("cria modelo com orientacoes, fases e etapas em transacao", async () => {
    db.query.workflowCategorias.findFirst.mockResolvedValue({ id: "cat-1" });
    tx.returning
      .mockResolvedValueOnce([{ id: "modelo-1" }])
      .mockResolvedValueOnce([{ id: "fase-1" }]);

    await service.criar(gestao, dtoModelo);

    expect(db.transaction).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalledWith(workflowModelos);
    expect(tx.insert).toHaveBeenCalledWith(workflowOrientacoes);
    expect(tx.insert).toHaveBeenCalledWith(workflowFases);
    expect(tx.insert).toHaveBeenCalledWith(workflowEtapas);
    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: "school-1",
        unitId: "unit-1",
        categoriaId: "cat-1",
        criadoPor: "gestor-1",
        status: "RASCUNHO",
      }),
    );
    expect(tx.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          modeloId: "modelo-1",
          titulo: "Objetivo",
          conteudo: "Organizar",
        }),
      ]),
    );
    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        modeloId: "modelo-1",
        nome: "Preparacao",
      }),
    );
    expect(tx.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          faseId: "fase-1",
          titulo: "Definir data",
          instrucao: null,
        }),
      ]),
    );
  });

  it("reset etapa alterada em execucoes abertas de modelo publicado", async () => {
    db.query.workflowModelos.findFirst.mockResolvedValue(modeloPublicado);
    db.query.workflowExecucoes.findMany.mockResolvedValue([
      { id: "execucao-1" },
      { id: "execucao-2" },
    ]);

    await service.atualizar(gestao, "modelo-1", {
      fases: [
        {
          id: "fase-1",
          nome: "Preparacao",
          ordem: 1,
          etapas: [
            {
              id: "etapa-1",
              titulo: "Novo",
              instrucao: null,
              ordem: 1,
            },
          ],
        },
      ],
    });

    expect(tx.update).toHaveBeenCalledWith(workflowEtapas);
    expect(tx.update).toHaveBeenCalledWith(workflowEtapaProgresso);
    expect(tx.update).toHaveBeenCalledWith(workflowExecucoes);
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({
        concluida: false,
        concluidaPor: null,
        concluidaAt: null,
        etapaVersao: 3,
      }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ modeloAtualizado: true }),
    );
    expect(historicoService.registrar).toHaveBeenCalledTimes(2);
    expect(historicoService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: "execucao-1",
        tipo: "MODELO_ATUALIZADO",
        autorId: "gestor-1",
      }),
    );
  });

  it("usuario comum nao lista rascunhos quando pede todos", async () => {
    db.query.workflowModelos.findMany.mockResolvedValue([]);

    await service.listar({ ...gestao, role: "professora" }, { status: "todos" });

    expect(db.query.workflowModelos.findMany).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith(workflowModelos.status, "PUBLICADO");
  });

  it("publicar exige ao menos uma fase e uma etapa", async () => {
    db.query.workflowModelos.findFirst.mockResolvedValue({
      ...modeloPublicado,
      status: "RASCUNHO",
      fases: [],
    });

    await expect(service.publicar(gestao, "modelo-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
