import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PlanningsService } from "./plannings.service";

// Mock do módulo @essencia/db
jest.mock("@essencia/db", () => ({
  getDb: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue([]),
  }),
  planoAulaPeriodo: {},
  planoAula: {},
  eq: jest.fn(),
  and: jest.fn(),
  asc: jest.fn(),
  sql: jest.fn(),
}));

// Mock do módulo @essencia/shared/config/quinzenas
jest.mock("@essencia/shared/config/quinzenas", () => ({
  getQuinzenaById: jest.fn(),
  getCurrentQuinzena2026: jest.fn(),
  isInVacationPeriod: jest.fn(),
  formatQuinzenaDateRange: jest.fn(),
  QUINZENAS_2026: [],
}));

// Mock do CalendarService
const mockCalendarService = {
  validateQuinzenaSchoolDays: jest.fn(),
};

// Importar CalendarService dinamicamente antes dos testes
import { CalendarService } from "../calendar/calendar.service";

describe("PlanningsService - Edição e Exclusão de Períodos", () => {
  let service: PlanningsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningsService,
        {
          provide: CalendarService,
          useValue: mockCalendarService,
        },
      ],
    }).compile();

    service = module.get<PlanningsService>(PlanningsService);
    jest.clearAllMocks();
  });

  describe("editarPeriodo", () => {
    it("deve permitir editar descrição sempre", async () => {
      const periodoMock = {
        id: "periodo-id",
        dataMaximaEntrega: new Date("2025-01-01"),
      };

      // Mockar buscarPorId e contarPlanosVinculados
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service, "buscarPorId").mockResolvedValue(periodoMock as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "contarPlanosVinculados").mockResolvedValue(5);

      // O método deve completar sem lançar erro
      await expect(
        service.editarPeriodo("periodo-id", { descricao: "Nova" }),
      ).resolves.toBeUndefined();
    });

    it("deve bloquear edição de datas se prazo expirou e há planos vinculados", async () => {
      const periodoMock = {
        id: "periodo-id",
        dataMaximaEntrega: new Date("2025-01-01"), // Prazo no passado
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service, "buscarPorId").mockResolvedValue(periodoMock as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "contarPlanosVinculados").mockResolvedValue(5);

      await expect(
        service.editarPeriodo("periodo-id", { dataInicio: "2026-04-01" }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.editarPeriodo("periodo-id", { dataInicio: "2026-04-01" }),
      ).rejects.toThrow(
        "Não é possível alterar datas de um período com prazo expirado e planos vinculados",
      );
    });

    it("deve permitir edição de datas se prazo não expirou", async () => {
      const periodoMock = {
        id: "periodo-id",
        dataMaximaEntrega: new Date("2099-12-31"), // Prazo no futuro
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service, "buscarPorId").mockResolvedValue(periodoMock as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "contarPlanosVinculados").mockResolvedValue(5);

      await expect(
        service.editarPeriodo("periodo-id", { dataInicio: "2026-04-01" }),
      ).resolves.toBeUndefined();
    });

    it("deve permitir edição de datas se não há planos vinculados", async () => {
      const periodoMock = {
        id: "periodo-id",
        dataMaximaEntrega: new Date("2025-01-01"), // Prazo no passado
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service, "buscarPorId").mockResolvedValue(periodoMock as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "contarPlanosVinculados").mockResolvedValue(0); // Sem planos vinculados

      await expect(
        service.editarPeriodo("periodo-id", { dataInicio: "2026-04-01" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("excluirPeriodo", () => {
    it("deve bloquear exclusão se houver planos vinculados", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "contarPlanosVinculados").mockResolvedValue(3);

      await expect(service.excluirPeriodo("periodo-id")).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.excluirPeriodo("periodo-id")).rejects.toThrow(
        "Não é possível excluir. 3 professoras já iniciaram este período.",
      );
    });

    it("deve permitir exclusão se não houver planos vinculados", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "contarPlanosVinculados").mockResolvedValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service, "buscarPorId").mockResolvedValue({
        id: "periodo-id",
        unidadeId: "unidade-id",
        etapa: "INFANTIL",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "renumerarPeriodosSeNecessario").mockResolvedValue(undefined);

      await expect(
        service.excluirPeriodo("periodo-id"),
      ).resolves.toBeUndefined();
    });
  });
});
