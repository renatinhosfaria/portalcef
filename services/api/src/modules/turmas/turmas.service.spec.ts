import { Test, TestingModule } from "@nestjs/testing";

import { PlanoAulaService } from "../plano-aula/plano-aula.service";
import { TurmasService } from "./turmas.service";

const mockTx = {
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

const mockDb = {
  query: {
    turmas: {
      findFirst: jest.fn(),
    },
    users: {
      findFirst: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  transaction: jest.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  and: jest.fn(),
  eq: jest.fn(),
  asc: jest.fn(),
  inArray: jest.fn(),
  turmas: {},
  units: {},
  users: {},
}));

jest.mock("@essencia/db/schema", () => ({
  turmas: {},
  units: {},
  users: {},
}));

describe("TurmasService — assignProfessora", () => {
  let service: TurmasService;
  const planoAulaServiceMock = {
    transferirPlanosPendentes: jest.fn(),
  };

  const ator = {
    userId: "coord-1",
    userName: "Coordenadora Ana",
    userRole: "coordenadora_geral",
  };

  const turmaBase = {
    id: "turma-1",
    unitId: "unit-1",
    stageId: "stage-1",
    code: "T1",
    year: 2026,
    isActive: true,
  };

  const profValida = {
    id: "prof-nova",
    role: "professora",
    unitId: "unit-1",
    stageId: "stage-1",
    name: "Joana Souza",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurmasService,
        { provide: PlanoAulaService, useValue: planoAulaServiceMock },
      ],
    }).compile();

    service = module.get<TurmasService>(TurmasService);
    jest.clearAllMocks();
  });

  it("dispara transferirPlanosPendentes quando há troca real (anterior diferente da nova)", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      professoraId: "prof-antiga",
    });
    mockDb.query.users.findFirst.mockResolvedValue(profValida);
    mockTx.returning.mockResolvedValueOnce([
      { ...turmaBase, professoraId: profValida.id },
    ]);
    planoAulaServiceMock.transferirPlanosPendentes.mockResolvedValue({
      planosTransferidos: ["plano-1"],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).assignProfessora("turma-1", profValida.id, ator);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(planoAulaServiceMock.transferirPlanosPendentes).toHaveBeenCalledWith(
      mockTx,
      "turma-1",
      "prof-antiga",
      profValida.id,
      ator,
    );
  });

  it("NÃO dispara transferirPlanosPendentes em atribuição inicial (turma sem professora anterior)", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      professoraId: null,
    });
    mockDb.query.users.findFirst.mockResolvedValue(profValida);
    mockDb.returning.mockResolvedValueOnce([
      { ...turmaBase, professoraId: profValida.id },
    ]);

    await service.assignProfessora("turma-1", profValida.id, ator);

    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(planoAulaServiceMock.transferirPlanosPendentes).not.toHaveBeenCalled();
  });

  it("NÃO dispara transferirPlanosPendentes quando a professora atribuída é a mesma já presente", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      professoraId: profValida.id,
    });
    mockDb.query.users.findFirst.mockResolvedValue(profValida);
    mockDb.returning.mockResolvedValueOnce([
      { ...turmaBase, professoraId: profValida.id },
    ]);

    await service.assignProfessora("turma-1", profValida.id, ator);

    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(planoAulaServiceMock.transferirPlanosPendentes).not.toHaveBeenCalled();
  });
});
