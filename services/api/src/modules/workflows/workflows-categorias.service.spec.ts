import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { asc, eq, workflowCategorias } from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import { WorkflowsCategoriasService } from "./workflows-categorias.service";
import type { WorkflowUserContext } from "./workflows.types";

const mockDb = {
  query: {
    workflowCategorias: { findMany: jest.fn(), findFirst: jest.fn() },
  },
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  onConflictDoNothing: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
};

jest.mock("@essencia/db", () => ({
  and: jest.fn((...condicoes: unknown[]) => ({
    operador: "and",
    condicoes,
  })),
  asc: jest.fn((campo: unknown) => ({ operador: "asc", campo })),
  eq: jest.fn((campo: unknown, valor: unknown) => ({
    operador: "eq",
    campo,
    valor,
  })),
  workflowCategorias: {
    id: "workflowCategorias.id",
    schoolId: "workflowCategorias.schoolId",
    unitId: "workflowCategorias.unitId",
    nome: "workflowCategorias.nome",
    ordem: "workflowCategorias.ordem",
  },
}));

const databaseService = { db: mockDb };
const mockAsc = asc as unknown as jest.Mock;
const mockEq = eq as unknown as jest.Mock;
const mockWorkflowCategorias = workflowCategorias as unknown as {
  id: string;
  schoolId: string;
  unitId: string;
  nome: string;
  ordem: string;
};

const gestao: WorkflowUserContext = {
  userId: "gestor-1",
  role: "coordenadora_geral",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: null,
};

const categoriaRenomeada = {
  id: "cat-renomeada",
  nome: "Festas",
  schoolId: "school-1",
  unitId: "unit-1",
};

function esperarFiltroTenant() {
  expect(mockEq).toHaveBeenCalledWith(
    mockWorkflowCategorias.schoolId,
    "school-1",
  );
  expect(mockEq).toHaveBeenCalledWith(
    mockWorkflowCategorias.unitId,
    "unit-1",
  );
}

describe("WorkflowsCategoriasService", () => {
  let service: WorkflowsCategoriasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsCategoriasService,
        { provide: DatabaseService, useValue: databaseService },
      ],
    }).compile();

    service = module.get(WorkflowsCategoriasService);
    jest.clearAllMocks();
    mockDb.query.workflowCategorias.findMany.mockReset();
    mockDb.query.workflowCategorias.findFirst.mockReset();
    mockDb.returning.mockReset();
  });

  it("exige unidade na sessao", async () => {
    await expect(
      service.listar({ ...gestao, unitId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cria categorias padrao antes de listar", async () => {
    mockDb.query.workflowCategorias.findFirst.mockResolvedValue(null);
    mockDb.query.workflowCategorias.findMany.mockResolvedValue([]);

    await service.listar(gestao);

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ nome: "Eventos", unitId: "unit-1" }),
        expect.objectContaining({ nome: "Documentos", unitId: "unit-1" }),
      ]),
    );
    expect(mockDb.onConflictDoNothing).toHaveBeenCalled();
    esperarFiltroTenant();
    expect(mockAsc).toHaveBeenCalledWith(mockWorkflowCategorias.ordem);
    expect(mockAsc).toHaveBeenCalledWith(mockWorkflowCategorias.nome);
  });

  it("nao recria categorias padrao quando a unidade ja possui categoria", async () => {
    mockDb.query.workflowCategorias.findFirst.mockResolvedValue(
      categoriaRenomeada,
    );
    mockDb.query.workflowCategorias.findMany.mockResolvedValue([
      categoriaRenomeada,
    ]);

    await service.listar(gestao);

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.query.workflowCategorias.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ operador: "and" }),
    });
    esperarFiltroTenant();
  });

  it("bloqueia criacao para usuario comum", async () => {
    await expect(
      service.criar({ ...gestao, role: "professora" }, { nome: "Rotinas" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("bloqueia atualizacao para usuario comum", async () => {
    await expect(
      service.atualizar(
        { ...gestao, role: "professora" },
        "cat-1",
        { nome: "Rotinas" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("atualiza categoria somente dentro do tenant", async () => {
    mockDb.returning.mockResolvedValue([
      { id: "cat-1", nome: "Rotinas", schoolId: "school-1", unitId: "unit-1" },
    ]);

    await service.atualizar(gestao, "cat-1", { nome: "Rotinas" });

    expect(mockDb.update).toHaveBeenCalledWith(mockWorkflowCategorias);
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Rotinas",
        updatedAt: expect.any(Date),
      }),
    );
    expect(mockEq).toHaveBeenCalledWith(mockWorkflowCategorias.id, "cat-1");
    esperarFiltroTenant();
  });

  it("retorna 404 ao atualizar categoria fora do tenant", async () => {
    mockDb.returning.mockResolvedValue([]);

    await expect(
      service.atualizar(gestao, "cat-outra", { nome: "Rotinas" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("bloqueia sugestoes para usuario comum", async () => {
    await expect(
      service.obterSugestoes({ ...gestao, role: "professora" }, "cat-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockDb.query.workflowCategorias.findFirst).not.toHaveBeenCalled();
  });

  it("retorna sugestoes de eventos pela categoria da unidade", async () => {
    mockDb.query.workflowCategorias.findFirst.mockResolvedValue({
      id: "cat-1",
      nome: "Eventos",
      schoolId: "school-1",
      unitId: "unit-1",
    });

    const sugestoes = await service.obterSugestoes(gestao, "cat-1");

    expect(sugestoes).toMatchObject({
      fases: expect.arrayContaining([
        expect.objectContaining({ nome: "Preparacao" }),
      ]),
      orientacoes: expect.arrayContaining([
        expect.objectContaining({ titulo: "Objetivo" }),
      ]),
    });
    expect(mockEq).toHaveBeenCalledWith(mockWorkflowCategorias.id, "cat-1");
    esperarFiltroTenant();
  });

  it("normaliza categoria com acento para sugestoes correspondentes", async () => {
    mockDb.query.workflowCategorias.findFirst.mockResolvedValue({
      id: "cat-1",
      nome: "Matrícula",
      schoolId: "school-1",
      unitId: "unit-1",
    });

    const sugestoes = await service.obterSugestoes(gestao, "cat-1");

    expect(sugestoes).toMatchObject({
      fases: expect.arrayContaining([
        expect.objectContaining({ nome: "Cadastro" }),
      ]),
      orientacoes: expect.arrayContaining([
        expect.objectContaining({ titulo: "Dados do aluno" }),
      ]),
    });
  });

  it("retorna 404 para categoria de outra unidade", async () => {
    mockDb.query.workflowCategorias.findFirst.mockResolvedValue(null);

    await expect(
      service.obterSugestoes(gestao, "cat-outra"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mockEq).toHaveBeenCalledWith(mockWorkflowCategorias.id, "cat-outra");
    esperarFiltroTenant();
  });
});
