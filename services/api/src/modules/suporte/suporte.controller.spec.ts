import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "../../common/storage/storage.service";
import { SuporteController } from "./suporte.controller";
import { SuporteService, type UserContext } from "./suporte.service";

jest.mock("@essencia/db", () => ({
  eq: jest.fn(() => ({})),
  and: jest.fn(() => ({})),
  desc: jest.fn(() => ({})),
  sql: jest.fn(() => ({})),
  ordemServico: {},
  ordemServicoMensagem: {},
  users: {},
}));

type ParteMultipart =
  | {
      type: "field";
      fieldname: string;
      value: string;
    }
  | {
      type: "file";
      fieldname: string;
      filename: string;
      mimetype: string;
      toBuffer: () => Promise<Buffer>;
    };

const usuarioBase: UserContext = {
  userId: "user-1",
  role: "professora",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: "stage-1",
};

function criarRequestMultipart(partes: ParteMultipart[], user = usuarioBase) {
  return {
    isMultipart: () => true,
    async *parts() {
      for (const parte of partes) {
        yield parte;
      }
    },
    user,
  };
}

describe("SuporteController", () => {
  let controller: SuporteController;

  const suporteServiceMock = {
    criar: jest.fn(),
    listar: jest.fn(),
    contagem: jest.fn(),
    buscarPorId: jest.fn(),
    validarEnvioMensagem: jest.fn(),
    enviarMensagem: jest.fn(),
    alterarStatus: jest.fn(),
    excluir: jest.fn(),
  };

  const storageServiceMock = {
    uploadBuffer: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuporteController],
      providers: [
        {
          provide: SuporteService,
          useValue: suporteServiceMock,
        },
        {
          provide: StorageService,
          useValue: storageServiceMock,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<SuporteController>(SuporteController);
    jest.clearAllMocks();
  });

  it("nao deve fazer upload ao criar OS com payload invalido", async () => {
    storageServiceMock.uploadBuffer.mockResolvedValue({
      url: "https://exemplo.com/arquivo.png",
      key: "suporte/arquivo.png",
      name: "arquivo.png",
    });

    const req = criarRequestMultipart([
      { type: "field", fieldname: "titulo", value: "ab" },
      {
        type: "field",
        fieldname: "descricao",
        value: "Descricao valida para teste",
      },
      { type: "field", fieldname: "categoria", value: "ERRO_SISTEMA" },
      {
        type: "file",
        fieldname: "arquivos",
        filename: "erro.png",
        mimetype: "image/png",
        toBuffer: async () => Buffer.from("conteudo"),
      },
    ]);

    await expect(
      controller.criarOrdemServico(req as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storageServiceMock.uploadBuffer).not.toHaveBeenCalled();
    expect(suporteServiceMock.criar).not.toHaveBeenCalled();
  });

  it("deve rejeitar descricao composta apenas por espacos", async () => {
    const req = criarRequestMultipart([
      { type: "field", fieldname: "titulo", value: "Titulo valido" },
      { type: "field", fieldname: "descricao", value: "          " },
      { type: "field", fieldname: "categoria", value: "ERRO_SISTEMA" },
    ]);

    await expect(
      controller.criarOrdemServico(req as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(suporteServiceMock.criar).not.toHaveBeenCalled();
  });

  it("deve rejeitar mais anexos do que o limite antes de fazer upload", async () => {
    const arquivos = Array.from({ length: 6 }, (_, indice) => ({
      type: "file" as const,
      fieldname: "arquivos",
      filename: `erro-${indice}.png`,
      mimetype: "image/png",
      toBuffer: async () => Buffer.from("conteudo"),
    }));
    const req = criarRequestMultipart([
      { type: "field", fieldname: "titulo", value: "Titulo valido" },
      {
        type: "field",
        fieldname: "descricao",
        value: "Descricao valida para teste",
      },
      { type: "field", fieldname: "categoria", value: "ERRO_SISTEMA" },
      ...arquivos,
    ]);

    await expect(
      controller.criarOrdemServico(req as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storageServiceMock.uploadBuffer).not.toHaveBeenCalled();
  });

  it("deve normalizar espacos externos antes de persistir a OS", async () => {
    suporteServiceMock.criar.mockResolvedValue({ id: "os-1" });

    const req = criarRequestMultipart([
      { type: "field", fieldname: "titulo", value: "  Titulo valido  " },
      {
        type: "field",
        fieldname: "descricao",
        value: "  Descricao valida para teste  ",
      },
      { type: "field", fieldname: "categoria", value: "ERRO_SISTEMA" },
    ]);

    await controller.criarOrdemServico(req as never);

    expect(suporteServiceMock.criar).toHaveBeenCalledWith(
      {
        titulo: "Titulo valido",
        descricao: "Descricao valida para teste",
        categoria: "ERRO_SISTEMA",
      },
      [],
      usuarioBase,
    );
  });

  it("deve remover anexos quando a persistencia da OS falhar", async () => {
    storageServiceMock.uploadBuffer.mockResolvedValue({
      url: "https://exemplo.com/arquivo.png",
      key: "suporte/arquivo.png",
      name: "arquivo.png",
    });
    suporteServiceMock.criar.mockRejectedValue(new Error("falha no banco"));

    const req = criarRequestMultipart([
      { type: "field", fieldname: "titulo", value: "Titulo valido" },
      {
        type: "field",
        fieldname: "descricao",
        value: "Descricao valida para teste",
      },
      { type: "field", fieldname: "categoria", value: "ERRO_SISTEMA" },
      {
        type: "file",
        fieldname: "arquivos",
        filename: "erro.png",
        mimetype: "image/png",
        toBuffer: async () => Buffer.from("conteudo"),
      },
    ]);

    await expect(controller.criarOrdemServico(req as never)).rejects.toThrow(
      "falha no banco",
    );
    expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
      "suporte/arquivo.png",
    );
  });

  it("deve remover anexos anteriores quando um upload posterior falhar", async () => {
    storageServiceMock.uploadBuffer
      .mockResolvedValueOnce({
        url: "https://exemplo.com/primeiro.png",
        key: "suporte/primeiro.png",
        name: "primeiro.png",
      })
      .mockRejectedValueOnce(new Error("falha no storage"));

    const req = criarRequestMultipart([
      { type: "field", fieldname: "titulo", value: "Titulo valido" },
      {
        type: "field",
        fieldname: "descricao",
        value: "Descricao valida para teste",
      },
      { type: "field", fieldname: "categoria", value: "ERRO_SISTEMA" },
      {
        type: "file",
        fieldname: "arquivos",
        filename: "primeiro.png",
        mimetype: "image/png",
        toBuffer: async () => Buffer.from("primeiro"),
      },
      {
        type: "file",
        fieldname: "arquivos",
        filename: "segundo.png",
        mimetype: "image/png",
        toBuffer: async () => Buffer.from("segundo"),
      },
    ]);

    await expect(controller.criarOrdemServico(req as never)).rejects.toThrow(
      "Erro ao fazer upload do arquivo",
    );
    expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
      "suporte/primeiro.png",
    );
  });

  it("nao deve fazer upload ao enviar mensagem sem permissao", async () => {
    storageServiceMock.uploadBuffer.mockResolvedValue({
      url: "https://exemplo.com/arquivo.png",
      key: "suporte/arquivo.png",
      name: "arquivo.png",
    });
    suporteServiceMock.validarEnvioMensagem.mockRejectedValue(
      new ForbiddenException("Sem permissao"),
    );
    suporteServiceMock.enviarMensagem.mockResolvedValue([]);

    const req = criarRequestMultipart([
      {
        type: "field",
        fieldname: "conteudo",
        value: "Mensagem de teste",
      },
      {
        type: "file",
        fieldname: "arquivos",
        filename: "erro.png",
        mimetype: "image/png",
        toBuffer: async () => Buffer.from("conteudo"),
      },
    ]);

    await expect(
      controller.enviarMensagem("os-1", req as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storageServiceMock.uploadBuffer).not.toHaveBeenCalled();
    expect(suporteServiceMock.enviarMensagem).not.toHaveBeenCalled();
  });

  it("deve excluir OS com sucesso", async () => {
    suporteServiceMock.excluir.mockResolvedValue(undefined);

    const resposta = await controller.excluirOrdemServico("os-1", {
      user: usuarioBase,
    });

    expect(suporteServiceMock.excluir).toHaveBeenCalledWith(
      "os-1",
      usuarioBase,
    );
    expect(resposta).toEqual({
      success: true,
      data: null,
    });
  });
});
