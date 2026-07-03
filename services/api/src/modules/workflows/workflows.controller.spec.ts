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
});
