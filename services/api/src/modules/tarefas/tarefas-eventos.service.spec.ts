jest.mock("@essencia/db", () => ({
  users: {
    role: "users.role",
    id: "users.id",
    schoolId: "users.schoolId",
    unitId: "users.unitId",
    inativadoEm: "users.inativadoEm",
  },
  educationStages: { id: "educationStages.id" },
  eq: jest.fn(),
  and: jest.fn(),
  isNull: jest.fn(),
  or: jest.fn(),
}));

import { TarefasEventosService } from "./tarefas-eventos.service";

describe("eventos de tarefas", () => {
  it("usa o usuário que disparou o evento como criador da tarefa automática", async () => {
    const criarAutomatica = jest.fn().mockResolvedValue(undefined);
    const concluirPorContexto = jest.fn().mockResolvedValue(null);
    const db = {
      db: {
        query: {
          users: {
            findFirst: jest.fn().mockResolvedValue({ id: "analista-1" }),
          },
          educationStages: { findFirst: jest.fn() },
        },
      },
    };
    const service = new TarefasEventosService(
      { criarAutomatica, concluirPorContexto } as never,
      db as never,
    );

    await service.onPlanoSubmetido({
      planoId: "plano-1",
      quinzenaId: "quinzena-1",
      professoraId: "professora-1",
      turmaId: "turma-1",
      etapaId: "etapa-1",
      schoolId: "escola-1",
      unitId: "unidade-1",
    });

    expect(concluirPorContexto).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: "professora-1",
        titulo: "Ajustar planejamento - Turma turma-1",
        planoId: "plano-1",
      }),
    );
    expect(criarAutomatica).toHaveBeenCalledWith(
      expect.objectContaining({ criadoPor: "professora-1" }),
    );
    expect(criarAutomatica).toHaveBeenCalledWith(
      expect.objectContaining({
        contextos: [expect.objectContaining({ planoId: "plano-1" })],
      }),
    );
  });

  it("conclui a tarefa da coordenadora quando o plano é aprovado", async () => {
    const concluirPorContexto = jest.fn().mockResolvedValue(undefined);
    const db = {
      db: {
        query: {
          users: { findFirst: jest.fn() },
          educationStages: { findFirst: jest.fn() },
        },
      },
    };
    const service = new TarefasEventosService(
      { criarAutomatica: jest.fn(), concluirPorContexto } as never,
      db as never,
    );

    await service.onPlanoAprovadoFinal({
      planoId: "plano-1",
      quinzenaId: "quinzena-1",
      professoraId: "professora-1",
      turmaId: "turma-1",
      etapaId: "etapa-1",
      schoolId: "escola-1",
      unitId: "unidade-1",
      coordenadoraId: "coordenadora-1",
    });

    expect(concluirPorContexto).toHaveBeenCalledWith(
      expect.objectContaining({
        planoId: "plano-1",
        usuarioId: "coordenadora-1",
        titulo: "Aprovar planejamento - Turma turma-1",
      }),
    );
  });

  it("encerra a revisão do analista e cria a aprovação da coordenadora", async () => {
    const concluirPorContexto = jest.fn().mockResolvedValue(null);
    const criarAutomatica = jest.fn();
    const service = new TarefasEventosService(
      { concluirPorContexto, criarAutomatica } as never,
      {
        db: {
          query: {
            users: {
              findFirst: jest.fn().mockResolvedValue({ id: "coord-1" }),
            },
            educationStages: {
              findFirst: jest.fn().mockResolvedValue({ code: "INFANTIL" }),
            },
          },
        },
      } as never,
    );
    await service.onPlanoAprovadoAnalista({
      planoId: "plano-1",
      quinzenaId: "quinzena-1",
      professoraId: "prof-1",
      turmaId: "turma-1",
      etapaId: "etapa-1",
      schoolId: "escola-1",
      unitId: "unidade-1",
      analistaId: "analista-2",
    });
    expect(concluirPorContexto).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: "Revisar planejamento - Turma turma-1",
        usuarioId: "analista-2",
        planoId: "plano-1",
      }),
    );
    expect(criarAutomatica).toHaveBeenCalledWith(
      expect.objectContaining({
        responsavel: "coord-1",
        titulo: "Aprovar planejamento - Turma turma-1",
      }),
    );
  });

  it.each([
    ["REVISAO", undefined, "Revisar", "Ajustar", "prof-1"],
    ["APROVACAO", "analista-1", "Aprovar", "Revisar", "analista-1"],
    ["APROVACAO", "prof-1", "Aprovar", "Ajustar", "prof-1"],
  ] as const)(
    "encerra a fase %s na devolução para %s",
    async (fase, responsavelId, anterior, proxima, responsavel) => {
      const concluirPorContexto = jest.fn().mockResolvedValue(null);
      const criarAutomatica = jest.fn();
      const service = new TarefasEventosService(
        { concluirPorContexto, criarAutomatica } as never,
        {} as never,
      );
      await service.onPlanoDevolvido({
        planoId: "plano-1",
        quinzenaId: "quinzena-1",
        professoraId: "prof-1",
        turmaId: "turma-1",
        etapaId: "etapa-1",
        schoolId: "escola-1",
        unitId: "unidade-1",
        revisorId: "gestora-1",
        fase,
        responsavelId,
        motivo: "Ajustar conteúdo",
      });
      expect(concluirPorContexto).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: `${anterior} planejamento - Turma turma-1`,
          usuarioId: "gestora-1",
        }),
      );
      expect(criarAutomatica).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: `${proxima} planejamento - Turma turma-1`,
          responsavel,
        }),
      );
    },
  );
});
