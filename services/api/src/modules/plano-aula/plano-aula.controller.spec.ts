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
  planoAula: {},
  planoAulaHistorico: {},
  planoDocumento: {},
  documentoComentario: {},
  quinzenaConfig: {},
  turmas: {},
  users: {},
}));

import { PlanoAulaController } from "./plano-aula.controller";
import type { UserContext } from "./plano-aula.service";

describe("PlanoAulaController", () => {
  const usuario: UserContext = {
    userId: "analista-1",
    role: "analista_pedagogico",
    schoolId: "escola-1",
    unitId: "unidade-1",
    stageId: null,
  };

  const reqComUsuario = {
    user: usuario,
    correlationId: "corr-1",
  };

  const documentoWord = {
    id: "doc-1",
    storageKey: "planos/doc-1.docx",
    fileName: "Plano.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileSize: 1234,
    sharepointItemId: "item-antigo",
    sharepointEditUrl: null,
    editandoDesde: new Date("2026-05-18T22:40:00.000Z"),
  };

  const criarController = () => {
    const planoAulaService = {
      getPlanoById: jest.fn().mockResolvedValue({
        id: "plano-1",
        user: { id: usuario.userId },
      }),
      getDocumentoById: jest.fn().mockResolvedValue(documentoWord),
      adicionarDocumentoUpload: jest.fn().mockResolvedValue(documentoWord),
      atualizarDocumento: jest.fn().mockResolvedValue(undefined),
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
        url: "https://storage.test/arquivo-assinado",
      }),
      replaceFile: jest.fn().mockResolvedValue(undefined),
    };

    const sharePointService = {
      isConfigurado: jest.fn().mockReturnValue(true),
      calcularLimiteEdicao: jest
        .fn()
        .mockReturnValue(new Date("2026-05-18T14:40:00.000Z")),
      criarLinkVisualizacao: jest
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error("The resource could not be found."), {
            code: "itemNotFound",
          }),
        )
        .mockResolvedValueOnce({ embedUrl: "https://office.test/preview-novo" }),
      isItemNaoEncontrado: jest.fn().mockReturnValue(true),
      uploadParaSharePoint: jest.fn().mockResolvedValue("item-novo"),
      criarLinkCompartilhamento: jest.fn().mockResolvedValue({
        url: "https://sharepoint.test/link",
        directUrl: "https://sharepoint.test/direto",
      }),
      construirMsWordUrl: jest
        .fn()
        .mockReturnValue("ms-word:ofe|u|https://sharepoint.test/direto"),
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

    const ControllerComObservabilidade = PlanoAulaController as unknown as new (
      planoAulaService: unknown,
      storageService: unknown,
      historicoService: unknown,
      sharePointService: unknown,
      observabilidadeService: unknown,
    ) => PlanoAulaController;

    const controller = new ControllerComObservabilidade(
      planoAulaService as never,
      storageService as never,
      {} as never,
      sharePointService as never,
      observabilidadeService as never,
    );

    return {
      controller,
      planoAulaService,
      storageService,
      sharePointService,
      observabilidadeService,
    };
  };

  const criarReply = () => {
    const reply = {
      header: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnValue({ enviado: true }),
    };

    return reply;
  };

  describe("editarWord", () => {
    it("deve registrar sharepoint_word no sucesso com documento, plano, arquivo e duração", async () => {
      const { controller, observabilidadeService } = criarController();

      await controller.editarWord(reqComUsuario, "plano-1", "doc-1");

      expect(observabilidadeService.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          origem: "sharepoint",
          evento: "sharepoint_word",
          nivel: "info",
          correlationId: "corr-1",
          usuario: {
            id: usuario.userId,
            role: usuario.role,
            schoolId: usuario.schoolId,
            unitId: usuario.unitId,
          },
          arquivo: {
            planoId: "plano-1",
            documentoId: "doc-1",
            nome: "Plano.docx",
            tipo: documentoWord.mimeType,
            tamanhoBytes: 1234,
          },
          detalhes: expect.objectContaining({
            etapa: "editar_word",
            duracaoMs: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe("visualizarSharePoint", () => {
    it("deve reenviar documento quando item ativo salvo no SharePoint não existe mais", async () => {
      const { controller, planoAulaService, sharePointService } = criarController();

      const resultado = await controller.visualizarSharePoint(
        reqComUsuario,
        "plano-1",
        "doc-1",
      );

      expect(resultado).toEqual({
        success: true,
        data: {
          disponivel: true,
          embedUrl: "https://office.test/preview-novo",
        },
      });
      expect(sharePointService.criarLinkVisualizacao).toHaveBeenNthCalledWith(
        1,
        "item-antigo",
      );
      expect(sharePointService.uploadParaSharePoint).toHaveBeenCalledWith(
        "planos/doc-1.docx",
        "Plano.docx",
        "doc-1",
      );
      expect(planoAulaService.atualizarDocumento).toHaveBeenNthCalledWith(1, "doc-1", {
        sharepointItemId: null,
        sharepointEditUrl: null,
        editandoDesde: null,
      });
      expect(planoAulaService.atualizarDocumento).toHaveBeenNthCalledWith(
        2,
        "doc-1",
        expect.objectContaining({
          sharepointItemId: "item-novo",
          editandoDesde: expect.any(Date),
        }),
      );
      expect(sharePointService.criarLinkVisualizacao).toHaveBeenNthCalledWith(
        2,
        "item-novo",
      );
    });

    it("deve registrar sharepoint_word quando reenviar item ausente", async () => {
      const { controller, observabilidadeService } = criarController();

      await controller.visualizarSharePoint(reqComUsuario, "plano-1", "doc-1");

      expect(observabilidadeService.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          origem: "sharepoint",
          evento: "sharepoint_word",
          nivel: "info",
          correlationId: "corr-1",
          arquivo: expect.objectContaining({
            planoId: "plano-1",
            documentoId: "doc-1",
            nome: "Plano.docx",
          }),
          detalhes: expect.objectContaining({
            etapa: "visualizar_sharepoint",
            reenviado: true,
            duracaoMs: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe("downloadDocumento", () => {
    it("deve registrar arquivo_acao com ação download e status final", async () => {
      const { controller, observabilidadeService } = criarController();
      const reply = criarReply();

      await (controller.downloadDocumento as unknown as (
        reply: unknown,
        planoId: string,
        docId: string,
        req: unknown,
      ) => Promise<unknown>)(
        reply as never,
        "plano-1",
        "doc-1",
        reqComUsuario as never,
      );

      expect(observabilidadeService.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          origem: "storage",
          evento: "arquivo_acao",
          nivel: "info",
          correlationId: "corr-1",
          arquivo: expect.objectContaining({
            planoId: "plano-1",
            documentoId: "doc-1",
            nome: "Plano.docx",
            tipo: documentoWord.mimeType,
            tamanhoBytes: 1234,
          }),
          detalhes: expect.objectContaining({
            acao: "download",
            status: 200,
            duracaoMs: expect.any(Number),
          }),
        }),
      );
    });

    it("deve registrar nível error quando download falhar", async () => {
      const { controller, storageService, observabilidadeService } = criarController();
      storageService.getObject.mockRejectedValueOnce(new Error("falha storage"));
      const reply = criarReply();

      await (controller.downloadDocumento as unknown as (
        reply: unknown,
        planoId: string,
        docId: string,
        req: unknown,
      ) => Promise<unknown>)(
        reply as never,
        "plano-1",
        "doc-1",
        reqComUsuario as never,
      );

      expect(observabilidadeService.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          origem: "storage",
          evento: "arquivo_acao",
          nivel: "error",
          detalhes: expect.objectContaining({
            acao: "download",
            status: 500,
          }),
        }),
      );
    });
  });
});
