import { Test, TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";

import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";

const mockDb = {
  query: {
    users: {
      findFirst: jest.fn(),
    },
  },
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  eq: jest.fn(),
}));

jest.mock("@essencia/db/schema", () => ({
  users: {},
}));

describe("AuthService — login bloqueia inativos", () => {
  let service: AuthService;
  const sessionServiceMock = {
    createSession: jest.fn().mockResolvedValue("token-123"),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SessionService, useValue: sessionServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it("rejeita login de usuário inativo com mesma mensagem genérica de senha errada", async () => {
    const passwordHash = await bcrypt.hash("senha-correta", 12);
    mockDb.query.users.findFirst.mockResolvedValue({
      id: "u-1",
      email: "inativa@example.com",
      passwordHash,
      name: "Inativa",
      role: "professora",
      schoolId: "s-1",
      unitId: "u-1",
      stageId: "st-1",
      inativadoEm: new Date("2026-04-15T10:00:00Z"),
      inativadoPor: "coord-1",
    });

    await expect(
      service.login("inativa@example.com", "senha-correta"),
    ).rejects.toMatchObject({
      message: "Credenciais invalidas",
    });

    expect(sessionServiceMock.createSession).not.toHaveBeenCalled();
  });

  it("permite login de usuário ativo (inativadoEm = null)", async () => {
    const passwordHash = await bcrypt.hash("senha-correta", 12);
    mockDb.query.users.findFirst.mockResolvedValue({
      id: "u-2",
      email: "ativa@example.com",
      passwordHash,
      name: "Ativa",
      role: "professora",
      schoolId: "s-1",
      unitId: "u-1",
      stageId: "st-1",
      inativadoEm: null,
      inativadoPor: null,
    });

    const result = await service.login("ativa@example.com", "senha-correta");

    expect(result.token).toBe("token-123");
    expect(sessionServiceMock.createSession).toHaveBeenCalledTimes(1);
  });
});
