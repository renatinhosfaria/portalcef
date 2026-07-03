import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "../../common/storage/storage.service";
import { WorkflowsAnexosService } from "./workflows-anexos.service";
import { WorkflowsCategoriasService } from "./workflows-categorias.service";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsExecucoesService } from "./workflows-execucoes.service";
import { WorkflowsModelosService } from "./workflows-modelos.service";
import type { WorkflowUserContext } from "./workflows.types";

jest.mock("@essencia/db", () => ({
  and: jest.fn(),
  asc: jest.fn(),
  eq: jest.fn(),
  ilike: jest.fn(),
  inArray: jest.fn(),
  workflowCategorias: {
    id: "workflowCategorias.id",
    schoolId: "workflowCategorias.schoolId",
    unitId: "workflowCategorias.unitId",
    nome: "workflowCategorias.nome",
    ordem: "workflowCategorias.ordem",
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

const usuarioBase: WorkflowUserContext = {
  userId: "user-1",
  role: "professora",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: null,
};

describe("WorkflowsController", () => {
  let controller: WorkflowsController;

  const categoriasService = {
    listar: jest.fn(),
    criar: jest.fn(),
    atualizar: jest.fn(),
    obterSugestoes: jest.fn(),
  };
  const modelosService = {
    listar: jest.fn(),
    criar: jest.fn(),
    buscarPorId: jest.fn(),
    atualizar: jest.fn(),
    publicar: jest.fn(),
    inativar: jest.fn(),
    duplicar: jest.fn(),
  };
  const execucoesService = {
    iniciar: jest.fn(),
    listar: jest.fn(),
    buscarPorId: jest.fn(),
    editarTitulo: jest.fn(),
    atualizarEtapa: jest.fn(),
    concluir: jest.fn(),
    cancelar: jest.fn(),
    reabrir: jest.fn(),
    descartarTeste: jest.fn(),
  };
  const anexosService = {
    registrarUpload: jest.fn(),
    remover: jest.fn(),
  };
  const storageService = {
    uploadBuffer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [
        { provide: WorkflowsCategoriasService, useValue: categoriasService },
        { provide: WorkflowsModelosService, useValue: modelosService },
        { provide: WorkflowsExecucoesService, useValue: execucoesService },
        { provide: WorkflowsAnexosService, useValue: anexosService },
        { provide: StorageService, useValue: storageService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get(WorkflowsController);
    jest.clearAllMocks();
  });

  it("valida payload antes de criar categoria", async () => {
    await expect(
      controller.criarCategoria({ user: usuarioBase }, { nome: "" }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(categoriasService.criar).not.toHaveBeenCalled();
  });

  it("encaminha listagem de categorias com usuario da sessao", async () => {
    categoriasService.listar.mockResolvedValue([]);

    await expect(
      controller.listarCategorias({ user: usuarioBase }),
    ).resolves.toEqual({ success: true, data: [] });

    expect(categoriasService.listar).toHaveBeenCalledWith(usuarioBase);
  });

  it("marca controller para correspondencia exata de roles", () => {
    expect(Reflect.getMetadata("roles:exact", WorkflowsController)).toBe(true);
  });

  it("valida payload antes de criar modelo", async () => {
    await expect(
      controller.criarModelo({ user: usuarioBase }, { nome: "" }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(modelosService.criar).not.toHaveBeenCalled();
  });

  it("encaminha criacao de modelo com usuario da sessao", async () => {
    const dto = {
      categoriaId: "11111111-1111-1111-1111-111111111111",
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
    modelosService.criar.mockResolvedValue({ id: "modelo-1" });

    await expect(controller.criarModelo({ user: usuarioBase }, dto)).resolves.toEqual({
      success: true,
      data: { id: "modelo-1" },
    });

    expect(modelosService.criar).toHaveBeenCalledWith(usuarioBase, dto);
  });

  it("encaminha busca e acoes de modelo", async () => {
    modelosService.buscarPorId.mockResolvedValue({ id: "modelo-1" });
    modelosService.publicar.mockResolvedValue({ id: "modelo-1", status: "PUBLICADO" });
    modelosService.inativar.mockResolvedValue({ id: "modelo-1", status: "INATIVO" });
    modelosService.duplicar.mockResolvedValue({ id: "modelo-2", status: "RASCUNHO" });

    await expect(
      controller.buscarModelo({ user: usuarioBase }, "modelo-1"),
    ).resolves.toEqual({ success: true, data: { id: "modelo-1" } });
    await expect(
      controller.publicarModelo({ user: usuarioBase }, "modelo-1"),
    ).resolves.toEqual({
      success: true,
      data: { id: "modelo-1", status: "PUBLICADO" },
    });
    await expect(
      controller.inativarModelo({ user: usuarioBase }, "modelo-1"),
    ).resolves.toEqual({
      success: true,
      data: { id: "modelo-1", status: "INATIVO" },
    });
    await expect(
      controller.duplicarModelo({ user: usuarioBase }, "modelo-1"),
    ).resolves.toEqual({
      success: true,
      data: { id: "modelo-2", status: "RASCUNHO" },
    });

    expect(modelosService.buscarPorId).toHaveBeenCalledWith(usuarioBase, "modelo-1");
    expect(modelosService.publicar).toHaveBeenCalledWith(usuarioBase, "modelo-1");
    expect(modelosService.inativar).toHaveBeenCalledWith(usuarioBase, "modelo-1");
    expect(modelosService.duplicar).toHaveBeenCalledWith(usuarioBase, "modelo-1");
  });
});
