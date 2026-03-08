import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { DatabaseService } from "../../common/database/database.service";
import { SuporteService, type UserContext } from "./suporte.service";

jest.mock("@essencia/db", () => ({
  eq: jest.fn(() => ({})),
  and: jest.fn(() => ({})),
  desc: jest.fn(() => ({})),
  sql: jest.fn(() => ({})),
  ordemServico: {
    id: "id",
    schoolId: "schoolId",
    criadoPor: "criadoPor",
    status: "status",
  },
  ordemServicoMensagem: {
    id: "id",
  },
  users: {
    id: "id",
    name: "name",
    role: "role",
  },
}));

describe("SuporteService", () => {
  let service: SuporteService;

  const dbSelectChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
  };

  const dbInsertChain = {
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
  };

  const dbUpdateChain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn(),
  };

  const dbDeleteChain = {
    where: jest.fn(),
  };

  const txInsertChain = {
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
  };

  const txUpdateChain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn(),
  };

  const txMock = {
    insert: jest.fn().mockReturnValue(txInsertChain),
    update: jest.fn().mockReturnValue(txUpdateChain),
  };

  const dbMock = {
    select: jest.fn().mockReturnValue(dbSelectChain),
    insert: jest.fn().mockReturnValue(dbInsertChain),
    update: jest.fn().mockReturnValue(dbUpdateChain),
    delete: jest.fn().mockReturnValue(dbDeleteChain),
    transaction: jest.fn(async (callback: (tx: typeof txMock) => unknown) =>
      callback(txMock),
    ),
  };

  const sessao: UserContext = {
    userId: "user-1",
    role: "professora",
    schoolId: "school-1",
    unitId: "unit-1",
    stageId: "stage-1",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuporteService,
        {
          provide: DatabaseService,
          useValue: {
            db: dbMock,
          },
        },
      ],
    }).compile();

    service = module.get<SuporteService>(SuporteService);
    jest.clearAllMocks();
  });

  it("deve persistir mensagem e atualizar OS dentro de transacao", async () => {
    const osDb = {
      id: "os-1",
      criadoPor: "user-1",
      schoolId: "school-1",
      status: "ABERTA",
    };

    const mensagemTextoDb = {
      id: "msg-1",
      ordemServicoId: "os-1",
      conteudo: "Mensagem de teste",
      tipo: "TEXTO",
      arquivoUrl: null,
      arquivoNome: null,
      criadoPor: "user-1",
      createdAt: new Date("2026-02-20T12:00:00.000Z"),
    };

    const mensagemArquivoDb = {
      id: "msg-2",
      ordemServicoId: "os-1",
      conteudo: null,
      tipo: "IMAGEM",
      arquivoUrl: "https://exemplo.com/erro.png",
      arquivoNome: "erro.png",
      criadoPor: "user-1",
      createdAt: new Date("2026-02-20T12:01:00.000Z"),
    };

    dbSelectChain.where.mockResolvedValue([osDb]);
    dbInsertChain.returning
      .mockResolvedValueOnce([mensagemTextoDb])
      .mockResolvedValueOnce([mensagemArquivoDb]);
    dbUpdateChain.where.mockResolvedValue(undefined);
    txInsertChain.returning
      .mockResolvedValueOnce([mensagemTextoDb])
      .mockResolvedValueOnce([mensagemArquivoDb]);
    txUpdateChain.where.mockResolvedValue(undefined);

    const resultado = await service.enviarMensagem(
      "os-1",
      { conteudo: "Mensagem de teste" },
      [
        {
          url: "https://exemplo.com/erro.png",
          nome: "erro.png",
          mimetype: "image/png",
        },
      ],
      sessao,
    );

    expect(resultado).toHaveLength(2);
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(txMock.insert).toHaveBeenCalled();
    expect(txMock.update).toHaveBeenCalled();
  });

  it("deve excluir OS quando usuario e o criador", async () => {
    dbSelectChain.where.mockResolvedValue([
      {
        id: "os-1",
        criadoPor: "user-1",
        schoolId: "school-1",
      },
    ]);
    dbDeleteChain.where.mockResolvedValue(undefined);

    await service.excluir("os-1", sessao);

    expect(dbMock.delete).toHaveBeenCalled();
    expect(dbDeleteChain.where).toHaveBeenCalled();
  });

  it("deve impedir exclusao por usuario sem permissao", async () => {
    dbSelectChain.where.mockResolvedValue([
      {
        id: "os-1",
        criadoPor: "outro-usuario",
        schoolId: "school-1",
      },
    ]);

    await expect(service.excluir("os-1", sessao)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(dbMock.delete).not.toHaveBeenCalled();
  });
});
