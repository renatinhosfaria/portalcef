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
    unitStages: {
      findFirst: jest.fn(),
    },
  },
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
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
  unitStages: {},
  units: {},
  users: {},
}));

jest.mock("@essencia/db/schema", () => ({
  turmas: {},
  unitStages: {},
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
      providers: [TurmasService],
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
    const result = await service.assignProfessora("turma-1", profValida.id);

    expect(result.professoraId).toBe(profValida.id);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
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

    const result = await service.assignProfessora("turma-1", profValida.id);

    expect(result.professoraId).toBe(profValida.id);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
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

    const result = await service.assignProfessora("turma-1", profValida.id);

    expect(result.professoraId).toBe(profValida.id);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("rejeita atribuição de professora inativada", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      professoraId: null,
    });
    mockDb.query.users.findFirst.mockResolvedValue({
      ...profValida,
      inativadoEm: new Date(),
    });

    await expect(
      service.assignProfessora("turma-1", profValida.id),
    ).rejects.toThrow("Professora está inativa");
  });

  it("rejeita atribuição em turma arquivada", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue({
      ...turmaBase,
      isActive: false,
      professoraId: null,
    });
    mockDb.query.users.findFirst.mockResolvedValue(profValida);

    await expect(
      service.assignProfessora("turma-1", profValida.id),
    ).rejects.toThrow("Turma está inativa");
  });

  it("arquiva a turma sem removê-la do banco", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue(turmaBase);
    mockDb.returning.mockResolvedValueOnce([{ ...turmaBase, isActive: false }]);

    const result = await service.deactivate("turma-1");

    expect(result.isActive).toBe(false);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
  });

  it("rejeita criação quando a etapa não está ativa na unidade", async () => {
    mockDb.query.turmas.findFirst.mockResolvedValue(null);
    mockDb.query.unitStages.findFirst.mockResolvedValue(null);

    await expect(
      service.create({
        unitId: "11111111-1111-4111-8111-111111111111",
        stageId: "22222222-2222-4222-8222-222222222222",
        name: "Infantil A",
        code: "INF-A",
        year: 2026,
      }),
    ).rejects.toThrow("Etapa não está ativa nesta unidade");

    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
