jest.mock("@essencia/db", () => ({
  sql: jest.fn(),
}));

import { HealthService } from "./health.service";

describe("HealthService", () => {
  const execute = jest.fn();
  const database = { db: { execute } };
  const session = { ping: jest.fn() };

  let service: HealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    execute.mockResolvedValue([]);
    session.ping.mockResolvedValue(undefined);
    service = new HealthService(database as never, session as never);
  });

  it("retorna ok somente quando banco e Redis respondem", async () => {
    const resultado = await service.check();

    expect(resultado.status).toBe("ok");
    expect(resultado.database).toBe("connected");
    expect(resultado.redis).toBe("connected");
    expect(resultado).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      }),
    );
    expect(JSON.stringify(resultado)).not.toMatch(
      /DATABASE_URL|REDIS_URL|password|secret|postgres|redis:\/\//i,
    );
  });

  it("retorna degraded quando uma dependência falha", async () => {
    execute.mockRejectedValueOnce(new Error("conexão privada do banco"));

    const resultado = await service.check();

    expect(resultado.status).toBe("degraded");
    expect(resultado.database).toBe("disconnected");
    expect(resultado.redis).toBe("connected");
    expect(JSON.stringify(resultado)).not.toContain("conexão privada");
  });

  it("retorna unhealthy quando banco e Redis falham", async () => {
    execute.mockRejectedValueOnce(new Error("banco indisponível"));
    session.ping.mockRejectedValueOnce(new Error("Redis indisponível"));

    const resultado = await service.check();

    expect(resultado.status).toBe("unhealthy");
    expect(resultado.database).toBe("disconnected");
    expect(resultado.redis).toBe("disconnected");
  });

  it("converte timeout de dependência em estado desconectado", async () => {
    execute.mockImplementationOnce(
      () => new Promise(() => undefined),
    );
    service = new HealthService(database as never, session as never);
    (service as unknown as { timeoutMs: number }).timeoutMs = 5;

    const resultado = await service.check();

    expect(resultado.status).toBe("degraded");
    expect(resultado.database).toBe("disconnected");
    expect(resultado.redis).toBe("connected");
  });
});
