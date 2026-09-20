const mockQueueAdd = jest.fn().mockResolvedValue(undefined);
const mockQueueClose = jest.fn().mockResolvedValue(undefined);
const mockRedisQuit = jest.fn().mockResolvedValue(undefined);

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

import { ConfigService } from "@nestjs/config";
import {
  RelatorioPdfQueueService,
  RELATORIO_PDF_JOB_NAME,
} from "./relatorio-pdf-queue.service";

describe("RelatorioPdfQueueService", () => {
  let service: RelatorioPdfQueueService;
  let configService: ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockResolvedValue(undefined);
    mockQueueClose.mockResolvedValue(undefined);
    mockRedisQuit.mockResolvedValue(undefined);
    configService = {
      get: jest.fn().mockReturnValue("redis://localhost:6379"),
    } as unknown as ConfigService;
    service = new RelatorioPdfQueueService(configService);
  });

  describe("adicionar", () => {
    it("enfileira job com jobId aceito pelo BullMQ", async () => {
      await service.adicionar("doc-123");
      expect(mockQueueAdd).toHaveBeenCalledWith(
        RELATORIO_PDF_JOB_NAME,
        { documentoId: "doc-123" },
        expect.objectContaining({
          jobId: expect.stringMatching(/^relatorio-documento-doc-123-/),
        }),
      );
    });

    it("enfileira novo processamento quando o mesmo documento é aprovado novamente", async () => {
      await service.adicionar("doc-123");
      await service.adicionar("doc-123");

      const primeiroJobId = mockQueueAdd.mock.calls[0]?.[2]?.jobId;
      const segundoJobId = mockQueueAdd.mock.calls[1]?.[2]?.jobId;

      expect(mockQueueAdd).toHaveBeenCalledTimes(2);
      expect(segundoJobId).not.toBe(primeiroJobId);
    });

    it("propaga falha do Redis para o serviço marcar o documento como erro", async () => {
      mockQueueAdd.mockRejectedValueOnce(new Error("Redis down"));
      await expect(service.adicionar("doc-456")).rejects.toThrow("Redis down");
    });
  });

  describe("onModuleDestroy", () => {
    it("fecha queue e conexão Redis", async () => {
      await service.onModuleDestroy();
      expect(mockQueueClose).toHaveBeenCalled();
      expect(mockRedisQuit).toHaveBeenCalled();
    });
  });
});
