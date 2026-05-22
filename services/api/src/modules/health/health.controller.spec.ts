import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { HealthModule } from "./health.module";

describe("HealthController", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
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
});
