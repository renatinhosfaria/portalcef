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

import { ProvaController } from "./prova.controller";
import type { UserContext } from "./prova.service";

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

  const criarController = () => {
    const provaService = {
      getProvaById: jest.fn().mockResolvedValue({
        id: "prova-1",
        user: { id: usuario.userId },
      }),
      getDocumentoById: jest.fn().mockResolvedValue(documentoWord),
      atualizarDocumento: jest.fn().mockResolvedValue(undefined),
    };

    const storageService = {
      getObject: jest.fn().mockResolvedValue({
        Body: Buffer.from("arquivo"),
        ContentType: documentoWord.mimeType,
        ContentLength: documentoWord.fileSize,
      }),
      uploadFile: jest.fn(),
      replaceFile: jest.fn(),
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
      observabilidadeService,
    };
  };

  const criarReply = () => ({
    header: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnValue({ enviado: true }),
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
});
