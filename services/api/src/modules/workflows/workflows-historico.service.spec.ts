import { Test, TestingModule } from "@nestjs/testing";
import { workflowHistorico } from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import type { RegistrarHistoricoParams } from "./workflows.types";

const db = {
  insert: jest.fn(),
  values: jest.fn(),
};

jest.mock("@essencia/db", () => ({
  workflowHistorico: {},
}));

describe("WorkflowsHistoricoService", () => {
  let service: WorkflowsHistoricoService;

  beforeEach(async () => {
    db.insert.mockReturnValue(db);
    db.values.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsHistoricoService,
        { provide: DatabaseService, useValue: { db } },
      ],
    }).compile();

    service = module.get(WorkflowsHistoricoService);
    jest.clearAllMocks();
  });

  it("serializa metadata e registra evento no banco", async () => {
    await service.registrar({
      execucaoId: "execucao-1",
      tipo: "MODELO_ATUALIZADO",
      descricao: "Workflow modelo atualizado",
      autorId: "gestor-1",
      motivo: undefined,
      metadata: { modeloId: "modelo-1", etapasAtualizadas: ["etapa-1"] },
    });

    expect(db.insert).toHaveBeenCalledWith(workflowHistorico);
    expect(db.values).toHaveBeenCalledWith({
      execucaoId: "execucao-1",
      tipo: "MODELO_ATUALIZADO",
      descricao: "Workflow modelo atualizado",
      autorId: "gestor-1",
      motivo: null,
      metadata: JSON.stringify({
        modeloId: "modelo-1",
        etapasAtualizadas: ["etapa-1"],
      }),
    });
  });

  it("usa executor transacional quando informado", async () => {
    const tx = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockResolvedValue(undefined),
    };

    const registrar = service.registrar as (
      params: RegistrarHistoricoParams,
      executor?: typeof tx,
    ) => Promise<unknown>;

    await registrar(
      {
        execucaoId: "execucao-1",
        tipo: "MODELO_ATUALIZADO",
        descricao: "Workflow modelo atualizado",
        autorId: "gestor-1",
        metadata: null,
      },
      tx,
    );

    expect(tx.insert).toHaveBeenCalledWith(workflowHistorico);
    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: "execucao-1",
        metadata: null,
      }),
    );
    expect(db.insert).not.toHaveBeenCalled();
  });
});
