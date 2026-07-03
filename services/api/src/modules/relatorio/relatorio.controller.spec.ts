jest.mock("./relatorio.service", () => ({ RelatorioService: jest.fn() }));
jest.mock("./relatorio-historico.service", () => ({
  RelatorioHistoricoService: jest.fn(),
}));
jest.mock("../../common/guards/auth.guard", () => ({ AuthGuard: jest.fn() }));
jest.mock("../../common/guards/roles.guard", () => ({ RolesGuard: jest.fn() }));
jest.mock("../../common/guards/tenant.guard", () => ({ TenantGuard: jest.fn() }));
jest.mock("../../common/sharepoint/sharepoint.service", () => ({
  SharePointService: jest.fn(),
}));
jest.mock("../../common/storage/storage.service", () => ({
  StorageService: jest.fn(),
}));

import { GUARDS_METADATA } from "@nestjs/common/constants";

import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CreateRelatorioDto } from "./dto/relatorio.dto";
import { RelatorioController } from "./relatorio.controller";

describe("RelatorioController", () => {
  const usuarioSessao = {
    userId: "user-1",
    role: "professora",
    schoolId: "school-1",
    unitId: "unit-1",
    stageId: "stage-1",
  };

  const documentoWord = {
    id: "documento-1",
    relatorioId: "relatorio-1",
    fileName: "Relatorio.docx",
    storageKey: "relatorios/relatorio.docx",
    url: "https://cdn.exemplo.com/relatorio.docx",
    fileSize: 1024,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sharepointItemId: null,
    sharepointEditUrl: null,
    editandoDesde: null,
  };

  const UM_MB_EM_BYTES = 1024 * 1024;
  const LIMITE_UPLOAD_BYTES = 500 * UM_MB_EM_BYTES;

  function criarController() {
    const relatorioService = {
      adicionarDocumentoUpload: jest.fn().mockResolvedValue(documentoWord),
      devolverAnalista: jest.fn().mockResolvedValue({ id: "relatorio-1" }),
      editarWord: jest.fn().mockResolvedValue(undefined),
      getDocumentoById: jest.fn().mockResolvedValue(documentoWord),
      atualizarDocumento: jest.fn().mockResolvedValue(undefined),
    };
    const storageService = {
      uploadFile: jest.fn().mockResolvedValue({
        name: "Relatorio.docx",
        key: "relatorios/relatorio.docx",
        url: "https://cdn.exemplo.com/relatorio.docx",
      }),
    };
    const historicoService = {};
    const sharePointService = {
      isConfigurado: jest.fn().mockReturnValue(true),
      uploadParaSharePoint: jest.fn().mockResolvedValue("item-1"),
      criarLinkCompartilhamento: jest.fn().mockResolvedValue({
        directUrl: "https://sharepoint/relatorio.docx",
      }),
      construirMsWordUrl: jest
        .fn()
        .mockReturnValue("ms-word:ofe|u|https://sharepoint/relatorio.docx"),
      calcularLimiteEdicao: jest.fn().mockReturnValue(new Date("2026-05-22")),
    };
    const observabilidadeService = {
      criarUsuarioDoRequest: jest.fn((user) => ({
        id: user.userId,
        role: user.role,
        schoolId: user.schoolId,
        unitId: user.unitId,
      })),
      registrarEvento: jest.fn().mockResolvedValue(undefined),
    };
    const ControllerComArgsLivres = RelatorioController as unknown as new (
      ...args: unknown[]
    ) => RelatorioController;
    const controller = new ControllerComArgsLivres(
      relatorioService,
      storageService,
      historicoService,
      sharePointService,
      observabilidadeService,
    );

    return {
      controller,
      relatorioService,
      storageService,
      sharePointService,
      observabilidadeService,
    };
  }

  const criarBufferComTamanho = (tamanho: number) =>
    ({ length: tamanho }) as Buffer;

  const criarArquivoMultipart = (
    tamanho: number,
    mimetype =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ) => ({
    mimetype,
    filename: "Relatorio.docx",
    toBuffer: jest.fn().mockResolvedValue(criarBufferComTamanho(tamanho)),
  });

  const criarReqMultipart = (arquivo: unknown) =>
    ({
      isMultipart: () => true,
      file: jest.fn().mockResolvedValue(arquivo),
      user: usuarioSessao,
      correlationId: "correlation-relatorio",
    }) as never;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("é definido", () => {
    expect(RelatorioController).toBeDefined();
  });

  it("usa guards na ordem obrigatória", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, RelatorioController);

    expect(guards).toEqual([AuthGuard, RolesGuard, TenantGuard]);
  });

  it("preserva o DTO de criação no metadado do Body para validação", () => {
    const paramTypes = Reflect.getMetadata(
      "design:paramtypes",
      RelatorioController.prototype,
      "criar",
    );

    expect(paramTypes?.[1]).toBe(CreateRelatorioDto);
  });

  it("devolve relatório da analista sem repassar corpo de motivo", async () => {
    const { controller, relatorioService } = criarController();
    const req = {
      user: {
        ...usuarioSessao,
        role: "analista_pedagogico",
      },
    };
    const devolverAnalista = controller.devolverAnalista as unknown as (
      request: typeof req,
      relatorioId: string,
    ) => Promise<unknown>;

    await devolverAnalista.call(controller, req, "relatorio-1");

    expect(relatorioService.devolverAnalista).toHaveBeenCalledWith(
      "relatorio-1",
      req.user,
    );
  });

  it("registra arquivo_acao ao fazer upload de documento", async () => {
    jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1120);
    const { controller, observabilidadeService } = criarController();
    const req = {
      isMultipart: () => true,
      file: jest.fn().mockResolvedValue({
        mimetype:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename: "Relatorio.docx",
        toBuffer: jest.fn().mockResolvedValue(Buffer.alloc(1024)),
      }),
      user: usuarioSessao,
      correlationId: "correlation-relatorio",
    };

    await controller.adicionarDocumentoUpload("relatorio-1", req as never);

    expect(observabilidadeService.registrarEvento).toHaveBeenCalledWith({
      origem: "storage",
      evento: "arquivo_acao",
      nivel: "info",
      correlationId: "correlation-relatorio",
      usuario: {
        id: "user-1",
        role: "professora",
        schoolId: "school-1",
        unitId: "unit-1",
      },
      arquivo: {
        relatorioId: "relatorio-1",
        documentoId: "documento-1",
        nome: "Relatorio.docx",
        tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        tamanhoBytes: 1024,
      },
      detalhes: {
        acao: "upload",
        status: 201,
        duracaoMs: 120,
      },
    });
  });

  it("aceita upload de relatório com tamanho máximo de 500 MB", async () => {
    const { controller, relatorioService, storageService } = criarController();
    const arquivo = criarArquivoMultipart(LIMITE_UPLOAD_BYTES, "application/pdf");

    const resultado = await controller.adicionarDocumentoUpload(
      "relatorio-1",
      criarReqMultipart(arquivo),
    );

    expect(resultado.success).toBe(true);
    expect(storageService.uploadFile).toHaveBeenCalledWith(arquivo);
    expect(relatorioService.adicionarDocumentoUpload).toHaveBeenCalledWith(
      "relatorio-1",
      expect.objectContaining({
        fileSize: LIMITE_UPLOAD_BYTES,
        mimeType: "application/pdf",
      }),
      usuarioSessao,
    );
  });

  it("rejeita upload de relatório acima de 500 MB", async () => {
    const { controller } = criarController();

    await expect(
      controller.adicionarDocumentoUpload(
        "relatorio-1",
        criarReqMultipart(criarArquivoMultipart(LIMITE_UPLOAD_BYTES + 1)),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "FILE_TOO_LARGE",
        message: "Arquivo muito grande. Tamanho máximo: 500MB",
      }),
    });
  });

  it("registra sharepoint_word ao abrir documento para edição", async () => {
    jest.spyOn(Date, "now").mockReturnValueOnce(2000).mockReturnValueOnce(2145);
    const { controller, observabilidadeService } = criarController();
    const req = {
      user: usuarioSessao,
      correlationId: "correlation-word",
    };

    await controller.editarWord(req as never, "relatorio-1", "documento-1");

    expect(observabilidadeService.registrarEvento).toHaveBeenCalledWith({
      origem: "sharepoint",
      evento: "sharepoint_word",
      nivel: "info",
      correlationId: "correlation-word",
      usuario: {
        id: "user-1",
        role: "professora",
        schoolId: "school-1",
        unitId: "unit-1",
      },
      arquivo: {
        relatorioId: "relatorio-1",
        documentoId: "documento-1",
        nome: "Relatorio.docx",
        tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        tamanhoBytes: 1024,
      },
      detalhes: {
        etapa: "editar_word",
        duracaoMs: 145,
      },
    });
  });
});
