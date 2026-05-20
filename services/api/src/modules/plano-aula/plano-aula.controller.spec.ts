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

  const criarController = () => {
    const planoAulaService = {
      getPlanoById: jest.fn().mockResolvedValue({ id: "plano-1" }),
      getDocumentoById: jest.fn().mockResolvedValue({
        id: "doc-1",
        storageKey: "planos/doc-1.docx",
        fileName: "Plano.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sharepointItemId: "item-antigo",
        sharepointEditUrl: null,
        editandoDesde: new Date("2026-05-18T22:40:00.000Z"),
      }),
      atualizarDocumento: jest.fn().mockResolvedValue(undefined),
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
    };

    const controller = new PlanoAulaController(
      planoAulaService as never,
      {} as never,
      {} as never,
      sharePointService as never,
    );

    return { controller, planoAulaService, sharePointService };
  };

  describe("visualizarSharePoint", () => {
    it("deve reenviar documento quando item ativo salvo no SharePoint não existe mais", async () => {
      const { controller, planoAulaService, sharePointService } = criarController();

      const resultado = await controller.visualizarSharePoint(
        { user: usuario },
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
  });
});
