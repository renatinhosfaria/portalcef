import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { SessionService } from "../auth/session.service";
import { UsersService } from "./users.service";

const mockDb = {
  query: {
    users: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    turmas: {
      findMany: jest.fn(),
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
  asc: jest.fn(),
  eq: jest.fn(),
  isNull: jest.fn(),
  sql: jest.fn(),
}));

jest.mock("@essencia/db/schema", () => ({
  users: {},
  turmas: {},
}));

jest.mock("@essencia/shared/roles", () => ({
  ROLE_HIERARCHY: {
    master: 0,
    diretora_geral: 1,
    gerente_unidade: 2,
    coordenadora_geral: 4,
    professora: 11,
  },
  canManageRole: jest.fn((atorRole: string, alvoRole: string) => {
    const ranks: Record<string, number> = {
      master: 0,
      diretora_geral: 1,
      gerente_unidade: 2,
      coordenadora_geral: 4,
      professora: 11,
    };
    return (ranks[atorRole] ?? 999) < (ranks[alvoRole] ?? 999);
  }),
}));

jest.mock("@essencia/shared/types", () => ({
  stageRequiredRoles: [],
}));

const ator = {
  userId: "coord-1",
  role: "diretora_geral",
  schoolId: "s-1",
  unitId: "u-1",
  stageId: null,
};

const alvoAtivo = {
  id: "prof-1",
  email: "prof@example.com",
  name: "Professora Maria",
  role: "professora",
  schoolId: "s-1",
  unitId: "u-1",
  stageId: "st-1",
  inativadoEm: null,
  inativadoPor: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("UsersService — inativar", () => {
  let service: UsersService;
  const sessionServiceMock = {
    deleteAllUserSessions: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SessionService, useValue: sessionServiceMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it("inativa professora sem turmas vinculadas — seta timestamp e revoga sessões", async () => {
    mockDb.query.users.findFirst.mockResolvedValue(alvoAtivo);
    mockDb.query.turmas.findMany.mockResolvedValue([]);
    mockDb.returning.mockResolvedValue([
      { ...alvoAtivo, inativadoEm: new Date(), inativadoPor: ator.userId },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (service as any).inativar("prof-1", ator);

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        inativadoEm: expect.any(Date),
        inativadoPor: ator.userId,
      }),
    );
    expect(sessionServiceMock.deleteAllUserSessions).toHaveBeenCalledWith("prof-1");
    expect(result.inativadoEm).toBeInstanceOf(Date);
    expect(result.inativadoPor).toBe(ator.userId);
  });

  it("rejeita auto-inativação", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((service as any).inativar(ator.userId, ator)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("rejeita inativação por hierarquia inválida (alvo de role superior)", async () => {
    const atorBaixo = { ...ator, role: "professora", userId: "prof-2" };
    const alvoAlto = { ...alvoAtivo, id: "diretora-1", role: "diretora_geral" };

    mockDb.query.users.findFirst.mockResolvedValue(alvoAlto);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((service as any).inativar("diretora-1", atorBaixo)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("rejeita inativação de usuário já inativo", async () => {
    mockDb.query.users.findFirst.mockResolvedValue({
      ...alvoAtivo,
      inativadoEm: new Date("2026-04-15T10:00:00Z"),
      inativadoPor: "coord-1",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((service as any).inativar("prof-1", ator)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("rejeita inativação de professora com turmas vinculadas e retorna lista", async () => {
    mockDb.query.users.findFirst.mockResolvedValue(alvoAtivo);
    mockDb.query.turmas.findMany.mockResolvedValue([
      { id: "t-1", name: "1° Ano A", code: "1A" },
      { id: "t-2", name: "2° Ano B", code: "2B" },
    ]);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (service as any).inativar("prof-1", ator);
      fail("deveria ter lançado UnprocessableEntityException");
    } catch (err) {
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = (err as any).getResponse();
      expect(response.code).toBe("USUARIO_TEM_VINCULOS_ATIVOS");
      expect(response.turmas).toEqual([
        { id: "t-1", name: "1° Ano A", code: "1A" },
        { id: "t-2", name: "2° Ano B", code: "2B" },
      ]);
    }
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("não consulta turmas quando alvo é coordenadora (não-professora)", async () => {
    const alvoCoord = { ...alvoAtivo, role: "coordenadora_geral" };
    mockDb.query.users.findFirst.mockResolvedValue(alvoCoord);
    mockDb.returning.mockResolvedValue([{ ...alvoCoord, inativadoEm: new Date() }]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).inativar("prof-1", ator);

    expect(mockDb.query.turmas.findMany).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("UsersService — reativar", () => {
  let service: UsersService;
  const sessionServiceMock = {
    deleteAllUserSessions: jest.fn(),
  };

  const alvoInativo = {
    id: "prof-1",
    email: "prof@example.com",
    name: "Maria",
    role: "professora",
    schoolId: "s-1",
    unitId: "u-1",
    stageId: "st-1",
    inativadoEm: new Date("2026-04-15T10:00:00Z"),
    inativadoPor: "outra-coord",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SessionService, useValue: sessionServiceMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it("reativa usuário inativo — limpa timestamp e ator, não toca sessões", async () => {
    mockDb.query.users.findFirst.mockResolvedValue(alvoInativo);
    mockDb.returning.mockResolvedValue([
      { ...alvoInativo, inativadoEm: null, inativadoPor: null },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (service as any).reativar("prof-1", ator);

    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        inativadoEm: null,
        inativadoPor: null,
      }),
    );
    expect(result.inativadoEm).toBeNull();
    expect(sessionServiceMock.deleteAllUserSessions).not.toHaveBeenCalled();
  });

  it("rejeita auto-reativação", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((service as any).reativar(ator.userId, ator)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("rejeita reativação de usuário já ativo", async () => {
    mockDb.query.users.findFirst.mockResolvedValue({
      ...alvoInativo,
      inativadoEm: null,
      inativadoPor: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((service as any).reativar("prof-1", ator)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
