import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { DocumentosConversaoQueueService } from "./documentos-conversao.queue";

const mockQueue = { add: jest.fn(), close: jest.fn() };

jest.mock("bullmq", () => ({
  Queue: jest.fn(() => mockQueue),
}));

describe("DocumentosConversaoQueueService", () => {
  let service: DocumentosConversaoQueueService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DocumentosConversaoQueueService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("redis://localhost:6379"),
          },
        },
      ],
    }).compile();

    service = module.get(DocumentosConversaoQueueService);
  });

  it("enfileira job de conversao", async () => {
    await service.enfileirar({
      documentoId: "doc-1",
      planoId: "plano-1",
      storageKey: "planos/doc-1.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: "plano.docx",
    });

    expect(mockQueue.add).toHaveBeenCalledWith("converter", {
      documentoId: "doc-1",
      planoId: "plano-1",
      storageKey: "planos/doc-1.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: "plano.docx",
    });
  });
});
