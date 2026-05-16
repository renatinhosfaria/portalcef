import { BadRequestException } from "@nestjs/common";

import type { DatabaseService } from "../../common/database/database.service";
import { EventoInscricoesService } from "./evento-inscricoes.service";

jest.mock("@essencia/db", () => {
  const coluna = (name: string) => ({ name });
  const sqlTag = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }));

  return {
    and: jest.fn((...args: unknown[]) => ({ op: "and", args })),
    asc: jest.fn((arg: unknown) => ({ op: "asc", arg })),
    desc: jest.fn((arg: unknown) => ({ op: "desc", arg })),
    eq: jest.fn((left: unknown, right: unknown) => ({ op: "eq", left, right })),
    ilike: jest.fn((left: unknown, right: unknown) => ({
      op: "ilike",
      left,
      right,
    })),
    inArray: jest.fn((left: unknown, right: unknown) => ({
      op: "inArray",
      left,
      right,
    })),
    isNotNull: jest.fn((arg: unknown) => ({ op: "isNotNull", arg })),
    or: jest.fn((...args: unknown[]) => ({ op: "or", args })),
    sql: sqlTag,
    eventoInscricoes: {
      id: coluna("evento_inscricoes.id"),
      eventoSlug: coluna("evento_inscricoes.evento_slug"),
      numeroInscricao: coluna("evento_inscricoes.numero_inscricao"),
      nome: coluna("evento_inscricoes.nome"),
      cpf: coluna("evento_inscricoes.cpf"),
      email: coluna("evento_inscricoes.email"),
      telefone: coluna("evento_inscricoes.telefone"),
      presencaConfirmadaEm: coluna(
        "evento_inscricoes.presenca_confirmada_em",
      ),
      createdAt: coluna("evento_inscricoes.created_at"),
      updatedAt: coluna("evento_inscricoes.updated_at"),
    },
    eventoInscricaoFilhos: {
      inscricaoId: coluna("evento_inscricao_filhos.inscricao_id"),
      turmaFilho: coluna("evento_inscricao_filhos.turma_filho"),
      createdAt: coluna("evento_inscricao_filhos.created_at"),
    },
    eventoSorteios: {
      id: coluna("evento_sorteios.id"),
      eventoSlug: coluna("evento_sorteios.evento_slug"),
      brinde: coluna("evento_sorteios.brinde"),
      inscricaoId: coluna("evento_sorteios.inscricao_id"),
      numeroInscricao: coluna("evento_sorteios.numero_inscricao"),
      sorteadoEm: coluna("evento_sorteios.sorteado_em"),
      sorteadoPor: coluna("evento_sorteios.sorteado_por"),
    },
  };
});

type Resultado = Record<string, unknown>;

function criarSelectChain(resultado: Resultado[]) {
  const chain: any = {
    from: jest.fn(() => chain),
    innerJoin: jest.fn(() => chain),
    where: jest.fn(() => chain),
    orderBy: jest.fn(() => chain),
    limit: jest.fn(() => Promise.resolve(resultado)),
    offset: jest.fn(() => Promise.resolve(resultado)),
    then: Promise.resolve(resultado).then.bind(Promise.resolve(resultado)),
  };

  return chain;
}

function criarDbMock() {
  const selectResults: Resultado[][] = [];
  const updateResults: Resultado[][] = [];
  const insertResults: Resultado[][] = [];
  const updateSetValues: Resultado[] = [];
  const insertValues: Resultado[] = [];

  const updateChain: any = {
    set: jest.fn((values: Resultado) => {
      updateSetValues.push(values);
      return updateChain;
    }),
    where: jest.fn(() => updateChain),
    returning: jest.fn(() => Promise.resolve(updateResults.shift() ?? [])),
  };

  const insertChain: any = {
    values: jest.fn((values: Resultado) => {
      insertValues.push(values);
      return insertChain;
    }),
    returning: jest.fn(() => Promise.resolve(insertResults.shift() ?? [])),
  };

  const db: any = {
    selectResults,
    updateResults,
    insertResults,
    updateSetValues,
    insertValues,
    select: jest.fn(() => criarSelectChain(selectResults.shift() ?? [])),
    update: jest.fn(() => updateChain),
    insert: jest.fn(() => insertChain),
    transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) =>
      callback(db),
    ),
  };

  return db;
}

const inscricaoBase = {
  id: "inscricao-1",
  eventoSlug: "mae-por-inteiro",
  numeroInscricao: "123-456",
  nome: "Maria Silva",
  cpf: "123.456.789-00",
  dataNascimento: "1990-01-15",
  email: "maria@exemplo.com",
  telefone: "(34) 99999-9999",
  presencaConfirmadaEm: null,
  presencaConfirmadaPor: null,
  ipAddress: null,
  userAgent: null,
  createdAt: new Date("2026-05-15T12:00:00.000Z"),
  updatedAt: new Date("2026-05-15T12:00:00.000Z"),
};

describe("EventoInscricoesService", () => {
  let db: ReturnType<typeof criarDbMock>;
  let service: EventoInscricoesService;

  beforeEach(() => {
    jest.clearAllMocks();
    db = criarDbMock();
    service = new EventoInscricoesService({
      db,
    } as unknown as DatabaseService);
  });

  describe("presença", () => {
    it("confirma presença gravando data e usuário responsável", async () => {
      db.updateResults.push([
        {
          ...inscricaoBase,
          presencaConfirmadaEm: new Date("2026-05-16T12:00:00.000Z"),
          presencaConfirmadaPor: "usuario-1",
        },
      ]);
      db.selectResults.push([]);

      const result = await service.atualizarPresenca(
        "mae-por-inteiro",
        "inscricao-1",
        true,
        "usuario-1",
      );

      expect(result.presencaConfirmadaEm).toBeInstanceOf(Date);
      expect(result.presencaConfirmadaPor).toBe("usuario-1");
      expect(db.updateSetValues[0]?.presencaConfirmadaEm).toBeInstanceOf(Date);
      expect(db.updateSetValues[0]?.presencaConfirmadaPor).toBe("usuario-1");
    });

    it("desfaz presença limpando data e usuário responsável", async () => {
      db.updateResults.push([inscricaoBase]);
      db.selectResults.push([]);

      const result = await service.atualizarPresenca(
        "mae-por-inteiro",
        "inscricao-1",
        false,
        "usuario-1",
      );

      expect(result.presencaConfirmadaEm).toBeNull();
      expect(result.presencaConfirmadaPor).toBeNull();
      expect(db.updateSetValues[0]?.presencaConfirmadaEm).toBeNull();
      expect(db.updateSetValues[0]?.presencaConfirmadaPor).toBeNull();
    });
  });

  describe("sorteios", () => {
    it("sorteia apenas inscrita presente que ainda não ganhou brinde", async () => {
      const ganhadora = {
        ...inscricaoBase,
        presencaConfirmadaEm: new Date("2026-05-16T12:00:00.000Z"),
        presencaConfirmadaPor: "usuario-1",
      };
      db.selectResults.push([ganhadora]);
      db.insertResults.push([
        {
          id: "sorteio-1",
          eventoSlug: "mae-por-inteiro",
          brinde: "Cesta de café",
          inscricaoId: "inscricao-1",
          numeroInscricao: "123-456",
          sorteadoEm: new Date("2026-05-16T13:00:00.000Z"),
          sorteadoPor: "usuario-2",
          createdAt: new Date("2026-05-16T13:00:00.000Z"),
        },
      ]);

      const result = await service.sortearBrinde(
        "mae-por-inteiro",
        "Cesta de café",
        "usuario-2",
      );

      expect(result.brinde).toBe("Cesta de café");
      expect(result.numeroInscricao).toBe("123-456");
      expect(result.nome).toBe("Maria Silva");
      expect(db.insertValues[0]).toMatchObject({
        eventoSlug: "mae-por-inteiro",
        brinde: "Cesta de café",
        inscricaoId: "inscricao-1",
        numeroInscricao: "123-456",
        sorteadoPor: "usuario-2",
      });

      const dbModule = jest.requireMock("@essencia/db");
      expect(dbModule.isNotNull).toHaveBeenCalledWith(
        dbModule.eventoInscricoes.presencaConfirmadaEm,
      );

      const sqlChamadas = dbModule.sql.mock.calls.map(
        ([strings]: [TemplateStringsArray]) => Array.from(strings).join(" "),
      );
      expect(
        sqlChamadas.some(
          (sql: string) =>
            sql.includes("not exists") && sql.includes("evento_sorteios"),
        ),
      ).toBe(true);
      expect(sqlChamadas.some((sql: string) => sql.includes("random()"))).toBe(
        true,
      );
    });

    it("retorna erro claro quando não há inscritas elegíveis", async () => {
      db.selectResults.push([]);

      await expect(
        service.sortearBrinde("mae-por-inteiro", "Cesta de café", "usuario-2"),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it("não permite sortear brinde sem nome", async () => {
      await expect(
        service.sortearBrinde("mae-por-inteiro", "   ", "usuario-2"),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(db.transaction).not.toHaveBeenCalled();
    });
  });
});
