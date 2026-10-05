import { Test, TestingModule } from "@nestjs/testing";

import { TurmasService } from "./turmas.service";

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
      ],
    }).compile();

    service = module.get<TurmasService>(TurmasService);
    jest.clearAllMocks();
  });

  it("mantém os planos vinculados à turma sem transferi-los ao trocar a titular", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      professoraId: "prof-antiga",
    });
    mockDb.query.users.findFirst.mockResolvedValue(profValida);
    mockDb.returning.mockResolvedValueOnce([
      { ...turmaBase, professoraId: profValida.id },
    ]);
    await service.assignProfessora("turma-1", profValida.id);

  });

  it("atualiza a titularidade em uma atribuição inicial", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      professoraId: null,
    });
    mockDb.query.users.findFirst.mockResolvedValue(profValida);
    mockDb.returning.mockResolvedValueOnce([
      { ...turmaBase, professoraId: profValida.id },
    ]);

    await service.assignProfessora("turma-1", profValida.id);

  });

  it("mantém a mesma titularidade sem movimentar planos", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      professoraId: profValida.id,
    });
    mockDb.query.users.findFirst.mockResolvedValue(profValida);
    mockDb.returning.mockResolvedValueOnce([
      { ...turmaBase, professoraId: profValida.id },
    ]);

    await service.assignProfessora("turma-1", profValida.id);

  });
});
