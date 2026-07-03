import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

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
  and: jest.fn(),
  asc: jest.fn(),
  eq: jest.fn(),
  workflowCategorias: {},
}));

const databaseService = { db: mockDb };

const gestao: WorkflowUserContext = {
  userId: "gestor-1",
  role: "coordenadora_geral",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: null,
};

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
  });

  it("exige unidade na sessao", async () => {
    await expect(
      service.listar({ ...gestao, unitId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cria categorias padrao antes de listar", async () => {
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
  });

  it("bloqueia criacao para usuario comum", async () => {
    await expect(
      service.criar({ ...gestao, role: "professora" }, { nome: "Rotinas" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
  });

  it("retorna 404 para categoria de outra unidade", async () => {
    mockDb.query.workflowCategorias.findFirst.mockResolvedValue(null);

    await expect(
      service.obterSugestoes(gestao, "cat-outra"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
