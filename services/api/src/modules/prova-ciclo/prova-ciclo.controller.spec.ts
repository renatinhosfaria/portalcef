import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { ProvaCicloController } from "./prova-ciclo.controller";
import { ProvaCicloService } from "./prova-ciclo.service";
import type { ProvaCiclo } from "@essencia/db/schema";

jest.mock("@essencia/db", () => ({
  provaCiclo: {},
  eq: jest.fn(),
  and: jest.fn(),
  asc: jest.fn(),
  sql: jest.fn(),
  getDb: jest.fn(),
}));

jest.mock("@essencia/db/schema", () => ({
  prova: {},
  provaCiclo: {},
  turmas: {},
  educationStages: {},
}));

describe("ProvaCicloController", () => {
  let controller: ProvaCicloController;
  let service: ProvaCicloService;

  const cicloFixture = (
    sobrescritas: Partial<ProvaCiclo> = {},
  ): ProvaCiclo => ({
    id: "ciclo-id",
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
      controllers: [ProvaCicloController],
      providers: [
        {
          provide: ProvaCicloService,
          useValue: {
            criarCiclo: jest.fn(),
            listarPorUnidade: jest.fn(),
            buscarPorTurma: jest.fn(),
            buscarPorId: jest.fn(),
            editarCiclo: jest.fn(),
            excluirCiclo: jest.fn(),
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

    controller = module.get<ProvaCicloController>(ProvaCicloController);
    service = module.get<ProvaCicloService>(ProvaCicloService);
  });

  const rolesDe = (
    metodo: keyof Pick<
      ProvaCicloController,
      | "listarCiclos"
      | "buscarCiclosDaTurma"
      | "buscarCiclo"
      | "criarCiclo"
      | "editarCiclo"
      | "excluirCiclo"
    >,
  ): string[] =>
    Reflect.getMetadata(ROLES_KEY, ProvaCicloController.prototype[metodo]) ??
    [];

  describe("política de roles", () => {
    it("permite gerente_financeiro visualizar ciclos, mas não gerenciar", () => {
      expect(rolesDe("listarCiclos")).toContain("gerente_financeiro");
      expect(rolesDe("buscarCiclo")).toContain("gerente_financeiro");
      expect(rolesDe("criarCiclo")).not.toContain("gerente_financeiro");
      expect(rolesDe("editarCiclo")).not.toContain("gerente_financeiro");
      expect(rolesDe("excluirCiclo")).not.toContain("gerente_financeiro");
    });

    it("inclui master nas rotas de gestão de ciclos", () => {
      expect(rolesDe("listarCiclos")).toContain("master");
      expect(rolesDe("criarCiclo")).toContain("master");
      expect(rolesDe("editarCiclo")).toContain("master");
      expect(rolesDe("excluirCiclo")).toContain("master");
    });

    it("permite coordenadora_fundamental_i buscar ciclos por turma", () => {
      expect(rolesDe("buscarCiclosDaTurma")).toContain(
        "coordenadora_fundamental_i",
      );
    });

    it("permite analista_pedagogico visualizar ciclos, mas não gerenciar", () => {
      expect(rolesDe("listarCiclos")).toContain("analista_pedagogico");
      expect(rolesDe("buscarCiclo")).toContain("analista_pedagogico");
      expect(rolesDe("criarCiclo")).not.toContain("analista_pedagogico");
      expect(rolesDe("editarCiclo")).not.toContain("analista_pedagogico");
      expect(rolesDe("excluirCiclo")).not.toContain("analista_pedagogico");
    });
  });

  describe("POST /prova-ciclo", () => {
    it("deve permitir master criando ciclo de qualquer etapa", async () => {
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

      jest.spyOn(service, "criarCiclo").mockResolvedValue(cicloFixture());

      await expect(controller.criarCiclo(session, dto)).resolves.toBeDefined();
    });

    it("deve bloquear gerente_financeiro criando ciclo", async () => {
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

      await expect(controller.criarCiclo(session, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("PUT /prova-ciclo/:id", () => {
    it("deve repassar unitId da sessão ao editar ciclo", async () => {
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
        .mockResolvedValue(cicloFixture({ etapa: "INFANTIL" }));
      const editarSpy = jest
        .spyOn(service, "editarCiclo")
        .mockResolvedValue(cicloFixture());

      await controller.editarCiclo(session, "ciclo-id", dto);

      expect(editarSpy).toHaveBeenCalledWith("ciclo-id", "unidade-id", dto);
    });
  });

  describe("DELETE /prova-ciclo/:id", () => {
    it("deve repassar unitId da sessão ao excluir ciclo", async () => {
      const session = {
        role: "coordenadora_geral",
        unitId: "unidade-id",
        userId: "user-id",
        schoolId: "school-id",
        stageId: null,
      };
      jest
        .spyOn(service, "buscarPorId")
        .mockResolvedValue(cicloFixture({ etapa: "INFANTIL" }));
      const excluirSpy = jest
        .spyOn(service, "excluirCiclo")
        .mockResolvedValue({
          success: true,
          message: "Ciclo de prova excluido com sucesso",
        });

      await controller.excluirCiclo(session, "ciclo-id");

      expect(excluirSpy).toHaveBeenCalledWith("ciclo-id", "unidade-id");
    });
  });
});
