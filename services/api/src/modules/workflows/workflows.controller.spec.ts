import { BadRequestException, ForbiddenException } from "@nestjs/common";
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
  desc: jest.fn(),
  workflowAnexos: {
    createdAt: "workflowAnexos.createdAt",
  },
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
    teste: "workflowExecucoes.teste",
    iniciadoPor: "workflowExecucoes.iniciadoPor",
    titulo: "workflowExecucoes.titulo",
    createdAt: "workflowExecucoes.createdAt",
    updatedAt: "workflowExecucoes.updatedAt",
  },
  workflowFases: {
    id: "workflowFases.id",
    modeloId: "workflowFases.modeloId",
    ordem: "workflowFases.ordem",
  },
  workflowHistorico: {
    createdAt: "workflowHistorico.createdAt",
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

  it("valida payload antes de iniciar execucao", async () => {
    await expect(
      controller.iniciarExecucao({ user: usuarioBase }, "modelo-1", {
        titulo: "",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(execucoesService.iniciar).not.toHaveBeenCalled();
  });

  it("encaminha endpoints de consulta de execucoes", async () => {
    execucoesService.listar.mockResolvedValue([]);
    execucoesService.buscarPorId.mockResolvedValue({ id: "execucao-1" });

    await expect(
      controller.listarExecucoes(
        { user: usuarioBase },
        { status: "todos", teste: "false", busca: "Evento" },
      ),
    ).resolves.toEqual({ success: true, data: [] });
    await expect(
      controller.buscarExecucao({ user: usuarioBase }, "execucao-1"),
    ).resolves.toEqual({ success: true, data: { id: "execucao-1" } });

    expect(execucoesService.listar).toHaveBeenCalledWith(usuarioBase, {
      status: "todos",
      teste: false,
      busca: "Evento",
    });
    expect(execucoesService.buscarPorId).toHaveBeenCalledWith(
      usuarioBase,
      "execucao-1",
    );
  });

  it("encaminha criacao e edicao de execucao com payload validado", async () => {
    execucoesService.iniciar.mockResolvedValue({ id: "execucao-1" });
    execucoesService.editarTitulo.mockResolvedValue({
      id: "execucao-1",
      titulo: "Novo titulo",
    });
    execucoesService.atualizarEtapa.mockResolvedValue({
      etapaId: "11111111-1111-1111-1111-111111111111",
      concluida: true,
    });

    await expect(
      controller.iniciarExecucao({ user: usuarioBase }, "modelo-1", {
        titulo: "Evento Dia dos Pais",
      }),
    ).resolves.toEqual({ success: true, data: { id: "execucao-1" } });
    await expect(
      controller.editarTituloExecucao({ user: usuarioBase }, "execucao-1", {
        titulo: "Novo titulo",
      }),
    ).resolves.toEqual({
      success: true,
      data: { id: "execucao-1", titulo: "Novo titulo" },
    });
    await expect(
      controller.atualizarEtapa(
        { user: usuarioBase },
        "execucao-1",
        "11111111-1111-1111-1111-111111111111",
        { concluida: true, observacao: "Feito" },
      ),
    ).resolves.toEqual({
      success: true,
      data: {
        etapaId: "11111111-1111-1111-1111-111111111111",
        concluida: true,
      },
    });

    expect(execucoesService.iniciar).toHaveBeenCalledWith(usuarioBase, "modelo-1", {
      titulo: "Evento Dia dos Pais",
      teste: false,
    });
    expect(execucoesService.editarTitulo).toHaveBeenCalledWith(
      usuarioBase,
      "execucao-1",
      { titulo: "Novo titulo" },
    );
    expect(execucoesService.atualizarEtapa).toHaveBeenCalledWith(
      usuarioBase,
      "execucao-1",
      "11111111-1111-1111-1111-111111111111",
      { concluida: true, observacao: "Feito" },
    );
  });

  it("valida motivo obrigatorio antes de cancelar e reabrir", async () => {
    await expect(
      controller.cancelarExecucao({ user: usuarioBase }, "execucao-1", {
        motivo: "x",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.reabrirExecucao({ user: usuarioBase }, "execucao-1", {
        motivo: "",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(execucoesService.cancelar).not.toHaveBeenCalled();
    expect(execucoesService.reabrir).not.toHaveBeenCalled();
  });

  it("encaminha acoes de status e descarte de execucao", async () => {
    execucoesService.concluir.mockResolvedValue({
      id: "execucao-1",
      status: "CONCLUIDA",
    });
    execucoesService.cancelar.mockResolvedValue({
      id: "execucao-1",
      status: "CANCELADA",
    });
    execucoesService.reabrir.mockResolvedValue({
      id: "execucao-1",
      status: "EM_ANDAMENTO",
    });
    execucoesService.descartarTeste.mockResolvedValue(undefined);

    await expect(
      controller.concluirExecucao({ user: usuarioBase }, "execucao-1"),
    ).resolves.toEqual({
      success: true,
      data: { id: "execucao-1", status: "CONCLUIDA" },
    });
    await expect(
      controller.cancelarExecucao({ user: usuarioBase }, "execucao-1", {
        motivo: "Cancelamento solicitado",
      }),
    ).resolves.toEqual({
      success: true,
      data: { id: "execucao-1", status: "CANCELADA" },
    });
    await expect(
      controller.reabrirExecucao({ user: usuarioBase }, "execucao-1", {
        motivo: "Reabrir para ajuste",
      }),
    ).resolves.toEqual({
      success: true,
      data: { id: "execucao-1", status: "EM_ANDAMENTO" },
    });
    await expect(
      controller.descartarExecucaoTeste({ user: usuarioBase }, "execucao-1"),
    ).resolves.toEqual({ success: true, data: null });

    expect(execucoesService.concluir).toHaveBeenCalledWith(
      usuarioBase,
      "execucao-1",
    );
    expect(execucoesService.cancelar).toHaveBeenCalledWith(
      usuarioBase,
      "execucao-1",
      { motivo: "Cancelamento solicitado" },
    );
    expect(execucoesService.reabrir).toHaveBeenCalledWith(
      usuarioBase,
      "execucao-1",
      { motivo: "Reabrir para ajuste" },
    );
    expect(execucoesService.descartarTeste).toHaveBeenCalledWith(
      usuarioBase,
      "execucao-1",
    );
  });

  it("nao faz upload de anexo quando execucao nao e visivel", async () => {
    execucoesService.buscarPorId.mockRejectedValue(
      new ForbiddenException("Sem permissao"),
    );
    storageService.uploadBuffer.mockResolvedValue({
      url: "https://cdn/arquivo.pdf",
      key: "workflows/arquivo.pdf",
      name: "arquivo.pdf",
    });

    const parts = jest.fn(async function* () {
      yield {
        type: "file",
        fieldname: "arquivo",
        filename: "arquivo.pdf",
        mimetype: "application/pdf",
        toBuffer: async () => Buffer.from("%PDF-1.4"),
      };
    });
    const req = {
      user: usuarioBase,
      isMultipart: () => true,
      parts,
    };

    await expect(
      controller.enviarAnexo("exec-1", req as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(execucoesService.buscarPorId).toHaveBeenCalledWith(
      usuarioBase,
      "exec-1",
    );
    expect(parts).not.toHaveBeenCalled();
    expect(storageService.uploadBuffer).not.toHaveBeenCalled();
    expect(anexosService.registrarUpload).not.toHaveBeenCalled();
  });

  it("rejeita anexo quando request nao e multipart", async () => {
    execucoesService.buscarPorId.mockResolvedValue({ id: "exec-1" });
    const req = {
      user: usuarioBase,
      isMultipart: () => false,
      parts: jest.fn(),
    };

    await expect(
      controller.enviarAnexo("exec-1", req as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.uploadBuffer).not.toHaveBeenCalled();
    expect(anexosService.registrarUpload).not.toHaveBeenCalled();
  });

  it("rejeita anexo quando nenhum arquivo e enviado", async () => {
    execucoesService.buscarPorId.mockResolvedValue({ id: "exec-1" });
    const req = {
      user: usuarioBase,
      isMultipart: () => true,
      async *parts() {
        yield { type: "field", fieldname: "legenda", value: "Arquivo" };
      },
    };

    await expect(
      controller.enviarAnexo("exec-1", req as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.uploadBuffer).not.toHaveBeenCalled();
    expect(anexosService.registrarUpload).not.toHaveBeenCalled();
  });

  it("rejeita arquivo vazio antes do upload", async () => {
    execucoesService.buscarPorId.mockResolvedValue({ id: "exec-1" });
    const req = {
      user: usuarioBase,
      isMultipart: () => true,
      async *parts() {
        yield {
          type: "file",
          fieldname: "arquivo",
          filename: "vazio.pdf",
          mimetype: "application/pdf",
          toBuffer: async () => Buffer.alloc(0),
        };
      },
    };

    await expect(
      controller.enviarAnexo("exec-1", req as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.uploadBuffer).not.toHaveBeenCalled();
    expect(anexosService.registrarUpload).not.toHaveBeenCalled();
  });

  it("rejeita multiplos arquivos mesmo quando um esta vazio", async () => {
    execucoesService.buscarPorId.mockResolvedValue({ id: "exec-1" });
    const req = {
      user: usuarioBase,
      isMultipart: () => true,
      async *parts() {
        yield {
          type: "file",
          fieldname: "arquivo",
          filename: "vazio.pdf",
          mimetype: "application/pdf",
          toBuffer: async () => Buffer.alloc(0),
        };
        yield {
          type: "file",
          fieldname: "arquivo",
          filename: "arquivo.pdf",
          mimetype: "application/pdf",
          toBuffer: async () => Buffer.from("%PDF-1.4"),
        };
      },
    };

    await expect(
      controller.enviarAnexo("exec-1", req as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.uploadBuffer).not.toHaveBeenCalled();
    expect(anexosService.registrarUpload).not.toHaveBeenCalled();
  });
});
