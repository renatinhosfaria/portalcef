jest.mock("@essencia/db", () => ({
  getDb: jest.fn(),
  and: jest.fn(),
  eq: jest.fn(),
  or: jest.fn(),
  ne: jest.fn(),
  desc: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  inArray: jest.fn(),
  isNotNull: jest.fn(),
  prova: {},
  provaDocumento: {},
  provaCiclo: {},
  turmas: {},
  users: {},
}));

import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import {
  EXACT_ROLES_KEY,
  ROLES_KEY,
} from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ProvaController } from "./prova.controller";
import type { UserContext } from "./prova.service";
import {
  ANALISTA_ROLES,
  COORDENADORA_ROLES,
  GESTAO_ROLES,
  PROFESSORA_ROLES,
} from "./dto/prova.dto";

describe("ProvaController", () => {
  const usuario: UserContext = {
    userId: "analista-1",
    role: "analista_pedagogico",
    schoolId: "escola-1",
    unitId: "unidade-1",
    stageId: null,
  };

  const reqComUsuario = {
    user: usuario,
    correlationId: "corr-prova-1",
  };

  const documentoWord = {
    id: "doc-prova-1",
    storageKey: "provas/doc-prova-1.docx",
    fileName: "Prova.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileSize: 4321,
    sharepointItemId: null,
    sharepointEditUrl: null,
    editandoDesde: null,
  };

  const UM_MB_EM_BYTES = 1024 * 1024;
  const LIMITE_UPLOAD_BYTES = 500 * UM_MB_EM_BYTES;

  const criarController = () => {
    const provaService = {
      getProvaById: jest.fn().mockResolvedValue({
        id: "prova-1",
        user: { id: usuario.userId },
      }),
      getDocumentoById: jest.fn().mockResolvedValue(documentoWord),
      removerDocumento: jest.fn().mockResolvedValue(undefined),
      adicionarDocumentoUpload: jest.fn().mockResolvedValue(documentoWord),
      atualizarDocumento: jest.fn().mockResolvedValue(undefined),
      regerarPdfDocumento: jest.fn().mockResolvedValue({
        ...documentoWord,
        pdfStorageKey: "pdf/doc-prova-1.pdf",
        pdfUrl: "https://cdn/doc-prova-1.pdf",
      }),
    };

    const storageService = {
      getObject: jest.fn().mockResolvedValue({
        Body: Buffer.from("arquivo"),
        ContentType: documentoWord.mimeType,
        ContentLength: documentoWord.fileSize,
      }),
      uploadFile: jest.fn().mockResolvedValue({
        name: documentoWord.fileName,
        key: documentoWord.storageKey,
        url: "https://storage.test/prova-assinada",
      }),
      replaceFile: jest.fn().mockResolvedValue(undefined),
    };

    const sharePointService = {
      isConfigurado: jest.fn().mockReturnValue(true),
      calcularLimiteEdicao: jest
        .fn()
        .mockReturnValue(new Date("2026-05-18T14:40:00.000Z")),
      uploadParaSharePoint: jest.fn().mockResolvedValue("item-prova-1"),
      criarLinkCompartilhamento: jest.fn().mockResolvedValue({
        url: "https://sharepoint.test/link-prova",
        directUrl: "https://sharepoint.test/direto-prova",
      }),
      construirMsWordUrl: jest
        .fn()
        .mockReturnValue("ms-word:ofe|u|https://sharepoint.test/direto-prova"),
    };

    const observabilidadeService = {
      criarUsuarioDoRequest: jest.fn().mockReturnValue({
        id: usuario.userId,
        role: usuario.role,
        schoolId: usuario.schoolId,
        unitId: usuario.unitId,
      }),
      registrarEvento: jest.fn().mockResolvedValue(undefined),
    };

    const ControllerComObservabilidade = ProvaController as unknown as new (
      provaService: unknown,
      storageService: unknown,
      historicoService: unknown,
      sharePointService: unknown,
      observabilidadeService: unknown,
    ) => ProvaController;

    const controller = new ControllerComObservabilidade(
      provaService,
      storageService,
      {},
      sharePointService,
      observabilidadeService,
    );

    return {
      controller,
      provaService,
      storageService,
      observabilidadeService,
    };
  };

  const criarReply = () => ({
    header: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnValue({ enviado: true }),
  });

  const criarBufferComTamanho = (tamanho: number) =>
    ({ length: tamanho }) as Buffer;

  const criarArquivoMultipart = (
    tamanho: number,
    mimetype =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ) => ({
    mimetype,
    filename: "Prova.docx",
    toBuffer: jest.fn().mockResolvedValue(criarBufferComTamanho(tamanho)),
  });

  const criarReqMultipart = (arquivo: unknown) =>
    ({
      ...reqComUsuario,
      isMultipart: () => true,
      file: jest.fn().mockResolvedValue(arquivo),
    }) as never;

  describe("uploadDocumento", () => {
    it("deve aceitar arquivo com tamanho máximo de 500 MB", async () => {
      const { controller, provaService, storageService } = criarController();
      const arquivo = criarArquivoMultipart(LIMITE_UPLOAD_BYTES, "application/pdf");

      const resultado = await controller.uploadDocumento(
        "prova-1",
        criarReqMultipart(arquivo),
      );

      expect(resultado.success).toBe(true);
      expect(storageService.uploadFile).toHaveBeenCalledWith(arquivo);
      expect(provaService.adicionarDocumentoUpload).toHaveBeenCalledWith(
        "prova-1",
        expect.objectContaining({
          fileSize: LIMITE_UPLOAD_BYTES,
          mimeType: "application/pdf",
        }),
      );
    });

    it("deve rejeitar arquivo acima de 500 MB", async () => {
      const { controller } = criarController();

      await expect(
        controller.uploadDocumento(
          "prova-1",
          criarReqMultipart(criarArquivoMultipart(LIMITE_UPLOAD_BYTES + 1)),
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "FILE_TOO_LARGE",
          message: "Arquivo muito grande. Tamanho máximo: 500MB",
        }),
      });
    });
  });

  describe("atualizarDocumento", () => {
    it("deve aceitar reenvio de Word com tamanho máximo de 500 MB", async () => {
      const { controller, provaService, storageService } = criarController();
      const arquivo = criarArquivoMultipart(LIMITE_UPLOAD_BYTES);

      const resultado = await controller.atualizarDocumento(
        "prova-1",
        "doc-prova-1",
        criarReqMultipart(arquivo),
      );

      expect(resultado.success).toBe(true);
      expect(storageService.replaceFile).toHaveBeenCalledWith(
        documentoWord.storageKey,
        expect.objectContaining({ length: LIMITE_UPLOAD_BYTES }),
        documentoWord.mimeType,
        "Prova.docx",
      );
      expect(provaService.atualizarDocumento).toHaveBeenCalledWith(
        "doc-prova-1",
        expect.objectContaining({
          fileSize: LIMITE_UPLOAD_BYTES,
        }),
      );
    });
  });

  it("deve registrar sharepoint_word ao editar Word", async () => {
    const { controller, observabilidadeService } = criarController();

    await controller.editarWord(reqComUsuario, "prova-1", "doc-prova-1");

    expect(observabilidadeService.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        origem: "sharepoint",
        evento: "sharepoint_word",
        nivel: "info",
        correlationId: "corr-prova-1",
        usuario: {
          id: usuario.userId,
          role: usuario.role,
          schoolId: usuario.schoolId,
          unitId: usuario.unitId,
        },
        arquivo: {
          provaId: "prova-1",
          documentoId: "doc-prova-1",
          nome: "Prova.docx",
          tipo: documentoWord.mimeType,
          tamanhoBytes: 4321,
        },
        detalhes: expect.objectContaining({
          etapa: "editar_word",
          duracaoMs: expect.any(Number),
        }),
      }),
    );
  });

  it("deve registrar arquivo_acao ao baixar documento", async () => {
    const { controller, observabilidadeService } = criarController();
    const reply = criarReply();

    await (controller.downloadDocumento as unknown as (
      reply: unknown,
      provaId: string,
      docId: string,
      req: unknown,
    ) => Promise<unknown>)(
      reply,
      "prova-1",
      "doc-prova-1",
      reqComUsuario,
    );

    expect(observabilidadeService.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        origem: "storage",
        evento: "arquivo_acao",
        nivel: "info",
        correlationId: "corr-prova-1",
        arquivo: expect.objectContaining({
          provaId: "prova-1",
          documentoId: "doc-prova-1",
          nome: "Prova.docx",
          tipo: documentoWord.mimeType,
          tamanhoBytes: 4321,
        }),
        detalhes: expect.objectContaining({
          acao: "download",
          status: 200,
          duracaoMs: expect.any(Number),
        }),
      }),
    );
  });

  it("deve reprocessar PDF de impressão de prova", async () => {
    const { controller, provaService } = criarController();

    const resultado = await controller.regerarPdfDocumento(
      reqComUsuario,
      "doc-prova-1",
    );

    expect(provaService.regerarPdfDocumento).toHaveBeenCalledWith(
      usuario,
      "doc-prova-1",
    );
    expect(resultado).toEqual({
      success: true,
      data: expect.objectContaining({
        id: "doc-prova-1",
        pdfUrl: "https://cdn/doc-prova-1.pdf",
      }),
    });
  });

  it("deve repassar usuário e motivo ao excluir documento", async () => {
    const { controller, provaService } = criarController();

    await (controller.deletarDocumento as unknown as (
      provaId: string,
      docId: string,
      req: typeof reqComUsuario,
      body: { motivo: string },
    ) => Promise<unknown>)(
      "prova-1",
      "doc-prova-1",
      reqComUsuario,
      { motivo: "Arquivo enviado com conteúdo incorreto" },
    );

    expect(provaService.removerDocumento).toHaveBeenCalledWith(
      usuario,
      "prova-1",
      "doc-prova-1",
      "Arquivo enviado com conteúdo incorreto",
    );
  });

  it("bloqueia auxiliar administrativo na rota DELETE por meio do guard real", () => {
    const rota = ProvaController.prototype.deletarDocumento;
    const contexto = {
      getHandler: () => rota,
      getClass: () => ProvaController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            ...usuario,
            role: "auxiliar_administrativo",
          },
        }),
      }),
    } as never;
    const guard = new RolesGuard(new Reflector());

    expect(Reflect.getMetadata(EXACT_ROLES_KEY, rota)).toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, rota)).toEqual([
      ...PROFESSORA_ROLES,
      ...ANALISTA_ROLES,
      ...COORDENADORA_ROLES,
      ...GESTAO_ROLES,
    ]);
    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
  });
});
