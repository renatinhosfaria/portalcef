import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import Redis from "ioredis";

import { PlanoAulaPdfQueueService } from "./plano-aula-pdf-queue.service";

const mockQueueAdd = jest.fn();
const mockQueueClose = jest.fn();
const mockRedisQuit = jest.fn();

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
}));

jest.mock("ioredis", () =>
  jest.fn().mockImplementation(() => ({
    quit: mockRedisQuit,
  })),
);

describe("PlanoAulaPdfQueueService", () => {
  const configServiceMock = {
    get: jest.fn((key: string) => {
      if (key === "REDIS_URL") return "redis://redis:6379";
      return undefined;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockResolvedValue(undefined);
    mockQueueClose.mockResolvedValue(undefined);
    mockRedisQuit.mockResolvedValue(undefined);
  });

  it("adiciona job de geração de PDF com identificador único", async () => {
    const service = new PlanoAulaPdfQueueService(
      configServiceMock as unknown as ConfigService,
    );

    await service.adicionar("documento-1");

    expect(Redis).toHaveBeenCalledWith(
      "redis://redis:6379",
      expect.objectContaining({ maxRetriesPerRequest: null }),
    );
    expect(Queue).toHaveBeenCalledWith(
      "planejamento-pdf-impressao",
      expect.objectContaining({
        connection: expect.any(Object),
      }),
    );
    expect(mockQueueAdd).toHaveBeenCalledWith(
      "gerar-pdf",
      { documentoId: "documento-1" },
      {
        jobId: expect.stringMatching(/^plano-documento-documento-1-/),
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  });

  it("enfileira novo processamento quando o mesmo documento é aprovado novamente", async () => {
    const service = new PlanoAulaPdfQueueService(
      configServiceMock as unknown as ConfigService,
    );

    await service.adicionar("documento-reaprovado");
    await service.adicionar("documento-reaprovado");

    const primeiroJobId = mockQueueAdd.mock.calls[0]?.[2]?.jobId;
    const segundoJobId = mockQueueAdd.mock.calls[1]?.[2]?.jobId;

    expect(mockQueueAdd).toHaveBeenCalledTimes(2);
    expect(primeiroJobId).toEqual(
      expect.stringMatching(/^plano-documento-documento-reaprovado-/),
    );
    expect(segundoJobId).toEqual(
      expect.stringMatching(/^plano-documento-documento-reaprovado-/),
    );
    expect(segundoJobId).not.toBe(primeiroJobId);
  });

  it("não quebra o fluxo quando Redis falha ao enfileirar", async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    mockQueueAdd.mockRejectedValue(new Error("Redis indisponível"));

    const service = new PlanoAulaPdfQueueService(
      configServiceMock as unknown as ConfigService,
    );

    await expect(service.adicionar("documento-2")).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Falha ao enfileirar PDF do documento documento-2"),
    );

    errorSpy.mockRestore();
  });
});
