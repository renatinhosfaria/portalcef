import { Test, TestingModule } from "@nestjs/testing";

const mockReturning = jest.fn();
const mockValues = jest.fn(() => ({ returning: mockReturning }));
const mockInsert = jest.fn(() => ({ values: mockValues }));

const mockDb = {
  insert: mockInsert,
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
}));

jest.mock("@essencia/db/schema", () => ({
  semestreRelatorio: {
    id: "id",
    unidadeId: "unidadeId",
    etapa: "etapa",
    anoLetivo: "anoLetivo",
    semestre: "semestre",
  },
}));

import { SemestreRelatorioService } from "./semestre-relatorio.service";

describe("SemestreRelatorioService", () => {
  let service: SemestreRelatorioService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockReturning.mockResolvedValue([
      {
        id: "semestre-1",
        unidadeId: "unit-123",
        etapa: "INFANTIL",
        anoLetivo: 2026,
        semestre: 1,
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [SemestreRelatorioService],
    }).compile();

    service = module.get<SemestreRelatorioService>(SemestreRelatorioService);
  });

  it("cria semestre de relatório com ano letivo e semestre", async () => {
    await service.criar(
      {
        etapa: "INFANTIL",
        anoLetivo: 2026,
        semestre: 1,
        dataInicio: "2026-01-20",
        dataFim: "2026-06-30",
        dataMaximaEntrega: "2026-07-05",
      },
      "unit-123",
      "user-456",
    );

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        unidadeId: "unit-123",
        etapa: "INFANTIL",
        anoLetivo: 2026,
        semestre: 1,
        criadoPor: "user-456",
      }),
    );
  });
});
