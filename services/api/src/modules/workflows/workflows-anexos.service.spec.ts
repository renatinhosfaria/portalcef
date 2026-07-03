import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { and, eq, workflowAnexos } from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import { StorageService } from "../../common/storage/storage.service";
import { WorkflowsAnexosService } from "./workflows-anexos.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import type { WorkflowUserContext } from "./workflows.types";

jest.mock("@essencia/db", () => ({
  and: jest.fn(() => "and-filtro"),
  eq: jest.fn((campo: unknown, valor: unknown) => ({ campo, valor })),
  workflowAnexos: {
    id: "workflowAnexos.id",
    execucaoId: "workflowAnexos.execucaoId",
  },
}));

const db = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  query: {
    workflowAnexos: { findFirst: jest.fn() },
  },
  delete: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
};

const usuarioBase: WorkflowUserContext = {
  userId: "user-1",
  role: "professora",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: null,
};

describe("WorkflowsAnexosService", () => {
  let service: WorkflowsAnexosService;
  const historico = { registrar: jest.fn() };
  const storage = { deleteFile: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsAnexosService,
        { provide: DatabaseService, useValue: { db } },
        { provide: StorageService, useValue: storage },
        { provide: WorkflowsHistoricoService, useValue: historico },
      ],
    }).compile();

    service = module.get(WorkflowsAnexosService);
    jest.clearAllMocks();
  });

  it("registra anexo e historico", async () => {
    const anexo = { id: "anexo-1", nomeOriginal: "arquivo.pdf" };
    db.returning.mockResolvedValue([anexo]);

    await expect(
      service.registrarUpload(usuarioBase, "exec-1", {
        url: "https://cdn/arquivo.pdf",
        storageKey: "workflows/arquivo.pdf",
        nomeOriginal: "arquivo.pdf",
        mimetype: "application/pdf",
        tamanhoBytes: 8,
      }),
    ).resolves.toEqual(anexo);

    expect(db.insert).toHaveBeenCalledWith(workflowAnexos);
    expect(db.values).toHaveBeenCalledWith({
      execucaoId: "exec-1",
      nomeOriginal: "arquivo.pdf",
      storageKey: "workflows/arquivo.pdf",
      url: "https://cdn/arquivo.pdf",
      mimeType: "application/pdf",
      tamanhoBytes: 8,
      enviadoPor: "user-1",
    });
    expect(historico.registrar).toHaveBeenCalledWith({
      execucaoId: "exec-1",
      tipo: "ANEXO_ENVIADO",
      descricao: "Anexo enviado",
      autorId: "user-1",
      metadata: {
        anexoId: "anexo-1",
        nomeOriginal: "arquivo.pdf",
      },
    });
  });

  it("remove anexo por id e execucao e registra historico", async () => {
    db.query.workflowAnexos.findFirst.mockResolvedValue({
      id: "anexo-1",
      storageKey: "workflows/arquivo.pdf",
      nomeOriginal: "arquivo.pdf",
    });

    await expect(
      service.remover(usuarioBase, "exec-1", "anexo-1"),
    ).resolves.toBeUndefined();

    expect(eq).toHaveBeenCalledWith(workflowAnexos.id, "anexo-1");
    expect(eq).toHaveBeenCalledWith(workflowAnexos.execucaoId, "exec-1");
    expect(and).toHaveBeenCalled();
    expect(storage.deleteFile).toHaveBeenCalledWith("workflows/arquivo.pdf");
    expect(db.delete).toHaveBeenCalledWith(workflowAnexos);
    expect(db.where).toHaveBeenCalledWith("and-filtro");
    expect(historico.registrar).toHaveBeenCalledWith({
      execucaoId: "exec-1",
      tipo: "ANEXO_REMOVIDO",
      descricao: "Anexo removido",
      autorId: "user-1",
      metadata: {
        anexoId: "anexo-1",
        nomeOriginal: "arquivo.pdf",
      },
    });
  });

  it("falha ao remover anexo inexistente", async () => {
    db.query.workflowAnexos.findFirst.mockResolvedValue(null);

    await expect(
      service.remover(usuarioBase, "exec-1", "anexo-inexistente"),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(historico.registrar).not.toHaveBeenCalled();
  });
});
