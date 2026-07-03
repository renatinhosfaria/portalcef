import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  eq,
  workflowEtapaProgresso,
  workflowExecucoes,
} from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import { StorageService } from "../../common/storage/storage.service";
import { WorkflowsExecucoesService } from "./workflows-execucoes.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import type { WorkflowUserContext } from "./workflows.types";

const tx = {
  insert: jest.fn(),
  values: jest.fn(),
  returning: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  where: jest.fn(),
  delete: jest.fn(),
};

const db = {
  query: {
    workflowModelos: { findFirst: jest.fn() },
    workflowExecucoes: { findFirst: jest.fn(), findMany: jest.fn() },
  },
  transaction: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  where: jest.fn(),
  returning: jest.fn(),
  delete: jest.fn(),
};

jest.mock("@essencia/db", () => ({
  and: jest.fn((...condicoes: unknown[]) => ({ operador: "and", condicoes })),
  asc: jest.fn((campo: unknown) => ({ operador: "asc", campo })),
  desc: jest.fn((campo: unknown) => ({ operador: "desc", campo })),
  eq: jest.fn((campo: unknown, valor: unknown) => ({
    operador: "eq",
    campo,
    valor,
  })),
  ilike: jest.fn((campo: unknown, valor: unknown) => ({
    operador: "ilike",
    campo,
    valor,
  })),
  workflowAnexos: {
    createdAt: "workflowAnexos.createdAt",
  },
  workflowEtapaProgresso: {
    execucaoId: "workflowEtapaProgresso.execucaoId",
    etapaId: "workflowEtapaProgresso.etapaId",
  },
  workflowEtapas: {
    ordem: "workflowEtapas.ordem",
  },
  workflowExecucoes: {
    id: "workflowExecucoes.id",
    schoolId: "workflowExecucoes.schoolId",
    unitId: "workflowExecucoes.unitId",
    modeloId: "workflowExecucoes.modeloId",
    titulo: "workflowExecucoes.titulo",
    status: "workflowExecucoes.status",
    teste: "workflowExecucoes.teste",
    iniciadoPor: "workflowExecucoes.iniciadoPor",
    createdAt: "workflowExecucoes.createdAt",
    updatedAt: "workflowExecucoes.updatedAt",
  },
  workflowFases: {
    ordem: "workflowFases.ordem",
  },
  workflowHistorico: {
    createdAt: "workflowHistorico.createdAt",
  },
  workflowModelos: {
    id: "workflowModelos.id",
    schoolId: "workflowModelos.schoolId",
    unitId: "workflowModelos.unitId",
    status: "workflowModelos.status",
    nome: "workflowModelos.nome",
  },
  workflowOrientacoes: {
    ordem: "workflowOrientacoes.ordem",
  },
}));

const professora: WorkflowUserContext = {
  userId: "prof-1",
  role: "professora",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: null,
};

const gestao: WorkflowUserContext = {
  ...professora,
  userId: "gestor-1",
  role: "coordenadora_geral",
};

const modeloPublicado = {
  id: "modelo-1",
  schoolId: "school-1",
  unitId: "unit-1",
  nome: "Evento Dia dos Pais",
  status: "PUBLICADO",
  fases: [
    {
      id: "fase-1",
      nome: "Preparacao",
      ordem: 1,
      etapas: [
        { id: "etapa-1", titulo: "Definir data", ordem: 1, versao: 1 },
        { id: "etapa-2", titulo: "Conferir materiais", ordem: 2, versao: 3 },
      ],
    },
  ],
};

function configurarCadeias() {
  tx.insert.mockReturnValue(tx);
  tx.values.mockReturnValue(tx);
  tx.update.mockReturnValue(tx);
  tx.set.mockReturnValue(tx);
  tx.where.mockReturnValue(tx);
  tx.delete.mockReturnValue(tx);
  db.update.mockReturnValue(db);
  db.set.mockReturnValue(db);
  db.where.mockReturnValue(db);
  db.delete.mockReturnValue(db);
  db.transaction.mockImplementation(async (cb: (txParam: typeof tx) => unknown) =>
    cb(tx),
  );
}

describe("WorkflowsExecucoesService", () => {
  let service: WorkflowsExecucoesService;
  const historicoService = { registrar: jest.fn() };
  const storageService = { deleteFile: jest.fn() };
  const mockEq = eq as unknown as jest.Mock;

  beforeEach(async () => {
    configurarCadeias();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsExecucoesService,
        { provide: DatabaseService, useValue: { db } },
        { provide: WorkflowsHistoricoService, useValue: historicoService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get(WorkflowsExecucoesService);
    jest.clearAllMocks();
    tx.returning.mockReset();
    db.returning.mockReset();
    db.query.workflowModelos.findFirst.mockReset();
    db.query.workflowExecucoes.findFirst.mockReset();
    db.query.workflowExecucoes.findMany.mockReset();
    historicoService.registrar.mockReset();
    storageService.deleteFile.mockReset();
  });

  it("inicia execucao real de modelo publicado para usuario comum", async () => {
    db.query.workflowModelos.findFirst.mockResolvedValue(modeloPublicado);
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-1",
      status: "EM_ANDAMENTO",
      iniciadoPor: "prof-1",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: false,
      modelo: modeloPublicado,
      progresso: [
        { etapaId: "etapa-1", concluida: false },
        { etapaId: "etapa-2", concluida: false },
      ],
      anexos: [],
      historico: [],
    });
    tx.returning.mockResolvedValue([{ id: "execucao-1", titulo: "Evento" }]);

    const execucao = await service.iniciar(professora, "modelo-1", {
      titulo: "Evento Dia dos Pais",
      teste: false,
    });

    expect(tx.insert).toHaveBeenCalledWith(workflowExecucoes);
    expect(tx.insert).toHaveBeenCalledWith(workflowEtapaProgresso);
    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: "school-1",
        unitId: "unit-1",
        modeloId: "modelo-1",
        titulo: "Evento Dia dos Pais",
        teste: false,
        iniciadoPor: "prof-1",
      }),
    );
    expect(tx.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          execucaoId: "execucao-1",
          etapaId: "etapa-1",
          etapaVersao: 1,
          concluida: false,
        }),
        expect.objectContaining({
          execucaoId: "execucao-1",
          etapaId: "etapa-2",
          etapaVersao: 3,
          concluida: false,
        }),
      ]),
    );
    expect(historicoService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: "execucao-1",
        tipo: "WORKFLOW_INICIADO",
        autorId: "prof-1",
        metadata: expect.objectContaining({
          modeloId: "modelo-1",
          teste: false,
        }),
      }),
      tx,
    );
    expect(execucao).toEqual(
      expect.objectContaining({
        id: "execucao-1",
        progresso: expect.arrayContaining([
          expect.objectContaining({ etapaId: "etapa-1" }),
        ]),
        faseAtual: "Preparacao",
      }),
    );
  });

  it("normaliza nome do usuario que enviou anexo", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-1",
      status: "EM_ANDAMENTO",
      iniciadoPor: "prof-1",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: false,
      modelo: modeloPublicado,
      progresso: [],
      anexos: [
        {
          id: "anexo-1",
          nomeOriginal: "arquivo.pdf",
          storageKey: "workflows/arquivo.pdf",
          enviadoPor: "user-2",
          enviadoPorUser: {
            name: "Maria Silva",
            email: "maria@essencia.edu.br",
          },
        },
      ],
      historico: [],
    });

    const execucao = await service.buscarPorId(professora, "execucao-1");

    expect(execucao.anexos).toEqual([
      expect.objectContaining({
        id: "anexo-1",
        enviadoPor: "user-2",
        enviadoPorNome: "Maria Silva",
      }),
    ]);
  });

  it("bloqueia usuario comum iniciando teste de rascunho", async () => {
    db.query.workflowModelos.findFirst.mockResolvedValue({
      ...modeloPublicado,
      status: "RASCUNHO",
    });

    await expect(
      service.iniciar(professora, "modelo-1", {
        titulo: "Teste de rascunho",
        teste: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("bloqueia concluir workflow com etapa pendente", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-1",
      status: "EM_ANDAMENTO",
      iniciadoPor: "prof-1",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: false,
      modelo: modeloPublicado,
      progresso: [
        { etapaId: "etapa-1", concluida: true },
        { etapaId: "etapa-2", concluida: false },
      ],
    });

    await expect(service.concluir(professora, "execucao-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(db.update).not.toHaveBeenCalled();
  });

  it("usuario comum nao ve execucao de outro usuario", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-1",
      status: "EM_ANDAMENTO",
      iniciadoPor: "outro-user",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: false,
      modelo: modeloPublicado,
      progresso: [],
    });

    await expect(
      service.buscarPorId(professora, "execucao-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("gestao reabre execucao concluida com motivo", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-1",
      status: "CONCLUIDA",
      iniciadoPor: "prof-1",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: false,
      modelo: modeloPublicado,
      progresso: [
        { etapaId: "etapa-1", concluida: true },
        { etapaId: "etapa-2", concluida: true },
      ],
    });
    tx.returning.mockResolvedValue([{ id: "execucao-1", status: "EM_ANDAMENTO" }]);

    await service.reabrir(gestao, "execucao-1", {
      motivo: "Ajuste necessario",
    });

    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "EM_ANDAMENTO",
        concluidoAt: null,
      }),
    );
    expect(historicoService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: "execucao-1",
        tipo: "EXECUCAO_REABERTA",
        motivo: "Ajuste necessario",
        autorId: "gestor-1",
      }),
      tx,
    );
  });

  it("listar de usuario comum filtra iniciadoPor e teste falso", async () => {
    db.query.workflowExecucoes.findMany.mockResolvedValue([]);

    await service.listar(professora, { status: "todos" });

    expect(db.query.workflowExecucoes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          operador: "and",
          condicoes: expect.arrayContaining([
            expect.objectContaining({
              campo: workflowExecucoes.iniciadoPor,
              valor: "prof-1",
            }),
            expect.objectContaining({
              campo: workflowExecucoes.teste,
              valor: false,
            }),
          ]),
        }),
      }),
    );
    expect(mockEq).toHaveBeenCalledWith(workflowExecucoes.iniciadoPor, "prof-1");
    expect(mockEq).toHaveBeenCalledWith(workflowExecucoes.teste, false);
  });

  it("buscar por id filtra tenant antes de aplicar visibilidade", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue(null);

    await expect(
      service.buscarPorId(professora, "execucao-1"),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockEq).toHaveBeenCalledWith(workflowExecucoes.id, "execucao-1");
    expect(mockEq).toHaveBeenCalledWith(workflowExecucoes.schoolId, "school-1");
    expect(mockEq).toHaveBeenCalledWith(workflowExecucoes.unitId, "unit-1");
  });

  it("atualizar etapa registra historico conforme conclusao e observacao", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-1",
      status: "EM_ANDAMENTO",
      iniciadoPor: "prof-1",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: false,
      modelo: modeloPublicado,
      progresso: [
        {
          etapaId: "etapa-1",
          concluida: false,
          observacao: "Aguardando",
          etapaVersao: 1,
        },
      ],
    });
    tx.returning.mockResolvedValue([
      {
        execucaoId: "execucao-1",
        etapaId: "etapa-1",
        concluida: true,
        observacao: "Feito",
      },
    ]);

    await service.atualizarEtapa(professora, "execucao-1", "etapa-1", {
      concluida: true,
      observacao: "Feito",
    });

    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({
        concluida: true,
        observacao: "Feito",
        concluidaPor: "prof-1",
        concluidaAt: expect.any(Date),
      }),
    );
    expect(historicoService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: "execucao-1",
        tipo: "ETAPA_CONCLUIDA",
        autorId: "prof-1",
        metadata: expect.objectContaining({ etapaId: "etapa-1" }),
      }),
      tx,
    );
    expect(historicoService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: "execucao-1",
        tipo: "OBSERVACAO_ETAPA_ALTERADA",
        autorId: "prof-1",
        metadata: expect.objectContaining({ etapaId: "etapa-1" }),
      }),
      tx,
    );
  });

  it("bloqueia cancelamento de execucao concluida", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-1",
      status: "CONCLUIDA",
      iniciadoPor: "prof-1",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: false,
      modelo: modeloPublicado,
      progresso: [
        { etapaId: "etapa-1", concluida: true },
        { etapaId: "etapa-2", concluida: true },
      ],
    });

    await expect(
      service.cancelar(professora, "execucao-1", {
        motivo: "Nao sera mais necessario",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("cancela execucao em andamento e registra historico na transacao", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-1",
      status: "EM_ANDAMENTO",
      iniciadoPor: "prof-1",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: false,
      modelo: modeloPublicado,
      progresso: [],
    });
    tx.returning.mockResolvedValue([{ id: "execucao-1", status: "CANCELADA" }]);

    await service.cancelar(professora, "execucao-1", {
      motivo: "Nao sera mais necessario",
    });

    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "CANCELADA",
        motivoCancelamento: "Nao sera mais necessario",
      }),
    );
    expect(historicoService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: "execucao-1",
        tipo: "EXECUCAO_CANCELADA",
        motivo: "Nao sera mais necessario",
      }),
      tx,
    );
  });

  it("usuario comum nao altera execucao de teste ou de outro usuario", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-1",
      status: "EM_ANDAMENTO",
      iniciadoPor: "prof-1",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: true,
      modelo: modeloPublicado,
      progresso: [{ etapaId: "etapa-1", concluida: false }],
    });

    await expect(
      service.editarTitulo(professora, "execucao-1", {
        titulo: "Novo titulo",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-2",
      status: "EM_ANDAMENTO",
      iniciadoPor: "outro-user",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: false,
      modelo: modeloPublicado,
      progresso: [{ etapaId: "etapa-1", concluida: false }],
    });

    await expect(
      service.atualizarEtapa(professora, "execucao-2", "etapa-1", {
        concluida: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("descarta teste com historico transacional antes de deletar", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "execucao-1",
      titulo: "Teste de fluxo",
      status: "EM_ANDAMENTO",
      iniciadoPor: "gestor-1",
      schoolId: "school-1",
      unitId: "unit-1",
      teste: true,
      modelo: modeloPublicado,
      progresso: [],
      anexos: [
        {
          id: "anexo-1",
          storageKey: "workflows/arquivo.pdf",
        },
      ],
    });

    await service.descartarTeste(gestao, "execucao-1");

    expect(tx.delete).toHaveBeenCalledWith(workflowExecucoes);
    expect(historicoService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: "execucao-1",
        tipo: "EXECUCAO_DESCARTADA",
        autorId: "gestor-1",
        metadata: expect.objectContaining({ titulo: "Teste de fluxo" }),
      }),
      tx,
    );
    expect(storageService.deleteFile).toHaveBeenCalledWith(
      "workflows/arquivo.pdf",
    );
  });
});
