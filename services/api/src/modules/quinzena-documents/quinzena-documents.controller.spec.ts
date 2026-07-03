jest.mock("@essencia/db", () => ({
  and: jest.fn(),
  desc: jest.fn(),
  eq: jest.fn(),
  getDb: jest.fn(),
  quinzenaDocuments: {},
}));

import { QuinzenaDocumentsController } from "./quinzena-documents.controller";

describe("QuinzenaDocumentsController", () => {
  const UM_MB_EM_BYTES = 1024 * 1024;
  const LIMITE_UPLOAD_BYTES = 500 * UM_MB_EM_BYTES;

  const usuario = {
    userId: "professora-1",
    role: "professora",
    schoolId: "escola-1",
    unitId: "unidade-1",
  };

  const criarController = () => {
    const documentsService = {
      create: jest.fn().mockResolvedValue({
        id: "documento-1",
        quinzenaId: "quinzena-1",
        fileName: "Plano.pdf",
        fileSize: LIMITE_UPLOAD_BYTES,
      }),
    };
    const storageService = {
      uploadFile: jest.fn().mockResolvedValue({
        name: "Plano.pdf",
        key: "quinzenas/plano.pdf",
        url: "https://storage.test/plano.pdf",
      }),
    };

    const controller = new QuinzenaDocumentsController(
      documentsService as never,
      storageService as never,
    );

    return { controller, documentsService, storageService };
  };

  const criarBufferComTamanho = (tamanho: number) =>
    ({ length: tamanho }) as Buffer;

  const criarArquivoMultipart = (tamanho: number) => ({
    mimetype: "application/pdf",
    filename: "Plano.pdf",
    fields: {
      quinzenaId: { value: "quinzena-1" },
    },
    toBuffer: jest.fn().mockResolvedValue(criarBufferComTamanho(tamanho)),
  });

  const criarReqMultipart = (arquivo: unknown) =>
    ({
      isMultipart: () => true,
      file: jest.fn().mockResolvedValue(arquivo),
      user: usuario,
    }) as never;

  it("aceita upload de documento da quinzena com tamanho máximo de 500 MB", async () => {
    const { controller, documentsService, storageService } = criarController();
    const arquivo = criarArquivoMultipart(LIMITE_UPLOAD_BYTES);

    const resultado = await controller.upload(criarReqMultipart(arquivo));

    expect(resultado.success).toBe(true);
    expect(storageService.uploadFile).toHaveBeenCalledWith(arquivo);
    expect(documentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fileSize: LIMITE_UPLOAD_BYTES,
        fileType: "application/pdf",
        quinzenaId: "quinzena-1",
      }),
    );
  });

  it("rejeita upload de documento da quinzena acima de 500 MB", async () => {
    const { controller } = criarController();

    await expect(
      controller.upload(criarReqMultipart(criarArquivoMultipart(LIMITE_UPLOAD_BYTES + 1))),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "FILE_TOO_LARGE",
        message: "Arquivo muito grande. Tamanho máximo: 500MB",
      }),
    });
  });
});
