import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";

jest.mock("@essencia/db", () => ({
  sql: jest.fn(),
}));

import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  let app: NestFastifyApplication;
  const healthService = {
    check: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix("api", {
      exclude: ["/health", "/api/health"],
    });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(() => {
    healthService.check.mockResolvedValue({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: 1,
      database: "connected",
      redis: "connected",
    });
  });

  afterAll(async () => {
    await (app as INestApplication).close();
  });

  it("responde o health interno sem prefixo", async () => {
    const resposta = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ status: "ok" }),
      }),
    );
  });

  it("responde o health público com prefixo /api", async () => {
    const resposta = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ status: "ok" }),
      }),
    );
  });

  it("responde 503 quando uma dependência está degradada", async () => {
    healthService.check.mockResolvedValueOnce({
      status: "degraded",
      timestamp: new Date().toISOString(),
      uptime: 1,
      database: "disconnected",
      redis: "connected",
    });

    const resposta = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual(
      expect.objectContaining({
        success: false,
        data: expect.objectContaining({ status: "degraded" }),
      }),
    );
  });
});
