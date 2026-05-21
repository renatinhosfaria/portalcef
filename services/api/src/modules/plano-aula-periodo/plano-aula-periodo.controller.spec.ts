import { Test, TestingModule } from "@nestjs/testing";
import { PlanoAulaPeriodoController } from "./plano-aula-periodo.controller";
import { PlanoAulaPeriodoService } from "./plano-aula-periodo.service";
import { ForbiddenException } from "@nestjs/common";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import type { PlanoAulaPeriodo } from "@essencia/db/schema";

// Mock do @essencia/db
jest.mock("@essencia/db", () => ({
  planoAulaPeriodo: {},
  eq: jest.fn(),
  and: jest.fn(),
  asc: jest.fn(),
  getDb: jest.fn(),
}));

describe("PlanoAulaPeriodoController", () => {
  let controller: PlanoAulaPeriodoController;
  let service: PlanoAulaPeriodoService;

  const periodoFixture = (
    sobrescritas: Partial<PlanoAulaPeriodo> = {},
  ): PlanoAulaPeriodo => ({
    id: "periodo-id",
    unidadeId: "unidade-id",
    etapa: "INFANTIL",
    numero: 1,
    descricao: null,
    dataInicio: "2026-03-01",
    dataFim: "2026-03-15",
    dataMaximaEntrega: "2026-02-25",
    criadoPor: "user-id",
    criadoEm: new Date("2026-01-01T00:00:00.000Z"),
    atualizadoEm: new Date("2026-01-01T00:00:00.000Z"),
    ...sobrescritas,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanoAulaPeriodoController],
      providers: [
        {
          provide: PlanoAulaPeriodoService,
          useValue: {
            criarPeriodo: jest.fn(),
            listarPorUnidade: jest.fn(),
            buscarPorTurma: jest.fn(),
            buscarPorId: jest.fn(),
            editarPeriodo: jest.fn(),
            excluirPeriodo: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PlanoAulaPeriodoController>(
      PlanoAulaPeriodoController,
    );
    service = module.get<PlanoAulaPeriodoService>(PlanoAulaPeriodoService);
  });

  const rolesDe = (
    metodo: keyof Pick<
      PlanoAulaPeriodoController,
      | "listarPeriodos"
      | "buscarPeriodosDaTurma"
      | "buscarPeriodo"
      | "criarPeriodo"
      | "editarPeriodo"
      | "excluirPeriodo"
    >,
  ): string[] =>
    Reflect.getMetadata(
      ROLES_KEY,
      PlanoAulaPeriodoController.prototype[metodo],
    ) ?? [];

  describe("política de roles", () => {
    it("permite gerente_financeiro visualizar períodos, mas não gerenciar", () => {
      expect(rolesDe("listarPeriodos")).toContain("gerente_financeiro");
      expect(rolesDe("buscarPeriodo")).toContain("gerente_financeiro");
      expect(rolesDe("criarPeriodo")).not.toContain("gerente_financeiro");
      expect(rolesDe("editarPeriodo")).not.toContain("gerente_financeiro");
      expect(rolesDe("excluirPeriodo")).not.toContain("gerente_financeiro");
    });

    it("inclui master nas rotas de gestão de períodos", () => {
      expect(rolesDe("listarPeriodos")).toContain("master");
      expect(rolesDe("criarPeriodo")).toContain("master");
      expect(rolesDe("editarPeriodo")).toContain("master");
      expect(rolesDe("excluirPeriodo")).toContain("master");
    });

    it("permite coordenadora_fundamental_i buscar períodos por turma", () => {
      expect(rolesDe("buscarPeriodosDaTurma")).toContain(
        "coordenadora_fundamental_i",
      );
    });

    it("permite analista_pedagogico visualizar períodos, mas não gerenciar", () => {
      expect(rolesDe("listarPeriodos")).toContain("analista_pedagogico");
      expect(rolesDe("buscarPeriodo")).toContain("analista_pedagogico");
      expect(rolesDe("criarPeriodo")).not.toContain("analista_pedagogico");
      expect(rolesDe("editarPeriodo")).not.toContain("analista_pedagogico");
      expect(rolesDe("excluirPeriodo")).not.toContain("analista_pedagogico");
    });
  });

  describe("POST /plano-aula-periodo", () => {
    it("deve permitir master criando período de qualquer etapa", async () => {
      const session = {
        role: "master",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "MEDIO",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      jest.spyOn(service, "criarPeriodo").mockResolvedValue(periodoFixture());

      await expect(
        controller.criarPeriodo(session, dto),
      ).resolves.toBeDefined();
    });

    it("deve bloquear gerente_financeiro criando período", async () => {
      const session = {
        role: "gerente_financeiro",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      await expect(controller.criarPeriodo(session, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("deve bloquear coordenadora_infantil criando período de FUNDAMENTAL_I", async () => {
      const session = {
        role: "coordenadora_infantil",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "FUNDAMENTAL_I",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      await expect(controller.criarPeriodo(session, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("deve permitir coordenadora_infantil criando período de INFANTIL", async () => {
      const session = {
        role: "coordenadora_infantil",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      jest.spyOn(service, "criarPeriodo").mockResolvedValue(periodoFixture());

      await expect(
        controller.criarPeriodo(session, dto),
      ).resolves.toBeDefined();
    });

    it("deve bloquear coordenadora_fundamental_i criando período de INFANTIL", async () => {
      const session = {
        role: "coordenadora_fundamental_i",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      await expect(controller.criarPeriodo(session, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("deve permitir coordenadora_fundamental_i criando período de FUNDAMENTAL_I", async () => {
      const session = {
        role: "coordenadora_fundamental_i",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "FUNDAMENTAL_I",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      jest.spyOn(service, "criarPeriodo").mockResolvedValue(periodoFixture());

      await expect(
        controller.criarPeriodo(session, dto),
      ).resolves.toBeDefined();
    });

    it("deve permitir diretora_geral criando período de qualquer etapa (INFANTIL)", async () => {
      const session = {
        role: "diretora_geral",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      jest.spyOn(service, "criarPeriodo").mockResolvedValue(periodoFixture());

      await expect(
        controller.criarPeriodo(session, dto),
      ).resolves.toBeDefined();
    });

    it("deve permitir diretora_geral criando período de qualquer etapa (FUNDAMENTAL_II)", async () => {
      const session = {
        role: "diretora_geral",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "FUNDAMENTAL_II",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      jest.spyOn(service, "criarPeriodo").mockResolvedValue(periodoFixture());

      await expect(
        controller.criarPeriodo(session, dto),
      ).resolves.toBeDefined();
    });

    it("deve permitir coordenadora_geral criando período de qualquer etapa", async () => {
      const session = {
        role: "coordenadora_geral",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "BERCARIO",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      jest.spyOn(service, "criarPeriodo").mockResolvedValue(periodoFixture());

      await expect(
        controller.criarPeriodo(session, dto),
      ).resolves.toBeDefined();
    });

    it("deve permitir gerente_unidade criando período de qualquer etapa", async () => {
      const session = {
        role: "gerente_unidade",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "MEDIO",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      jest.spyOn(service, "criarPeriodo").mockResolvedValue(periodoFixture());

      await expect(
        controller.criarPeriodo(session, dto),
      ).resolves.toBeDefined();
    });

    it("deve usar unitId e userId da sessão, não do payload", async () => {
      const session = {
        role: "coordenadora_infantil",
        unitId: "session-unidade-id",
        userId: "session-user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
      };

      const serviceSpy = jest
        .spyOn(service, "criarPeriodo")
        .mockResolvedValue(periodoFixture());

      await controller.criarPeriodo(session, dto);

      expect(serviceSpy).toHaveBeenCalledWith(
        "session-unidade-id",
        "session-user-id",
        dto,
      );
    });
  });

  describe("PUT /plano-aula-periodo/:id", () => {
    it("deve repassar unitId da sessão ao editar período", async () => {
      const session = {
        role: "coordenadora_geral",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      const dto = { descricao: "Nova descrição" };
      jest
        .spyOn(service, "buscarPorId")
        .mockResolvedValue(periodoFixture({ etapa: "INFANTIL" }));
      const editarSpy = jest
        .spyOn(service, "editarPeriodo")
        .mockResolvedValue(periodoFixture());

      await controller.editarPeriodo(session, "periodo-id", dto);

      expect(editarSpy).toHaveBeenCalledWith(
        "periodo-id",
        "unidade-id",
        dto,
      );
    });
  });

  describe("DELETE /plano-aula-periodo/:id", () => {
    it("deve repassar unitId da sessão ao excluir período", async () => {
      const session = {
        role: "coordenadora_geral",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      jest
        .spyOn(service, "buscarPorId")
        .mockResolvedValue(periodoFixture({ etapa: "INFANTIL" }));
      const excluirSpy = jest
        .spyOn(service, "excluirPeriodo")
        .mockResolvedValue({
          success: true,
          message: "Período excluído com sucesso",
        });

      await controller.excluirPeriodo(session, "periodo-id");

      expect(excluirSpy).toHaveBeenCalledWith("periodo-id", "unidade-id");
    });
  });
});
