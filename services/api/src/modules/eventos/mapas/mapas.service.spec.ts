import { BadRequestException, Logger } from "@nestjs/common";
import "reflect-metadata";
jest.mock("@essencia/db", () => {
  const tabela = (nome: string) => Object.fromEntries(["id", "eventId", "mapId", "sessionId", "orderId", "inventorySeatId", "status", "createdAt", "version"].map((campo) => [campo, `${nome}.${campo}`]));
  const eq = (coluna: unknown, valor: unknown) => ({ tipo: "eq", coluna, valor });
  const and = (...condicoes: unknown[]) => ({ tipo: "and", condicoes });
  const inArray = (coluna: unknown, valores: unknown[]) => ({ tipo: "inArray", coluna, valores });
  return {
    eventos: tabela("eventos"), eventoMapas: tabela("eventoMapas"), eventoSessoes: tabela("eventoSessoes"), eventoImportacoesMapa: tabela("eventoImportacoesMapa"), eventoDeteccoesMapa: tabela("eventoDeteccoesMapa"), eventoMapaAssentos: tabela("eventoMapaAssentos"), eventoInventarioAssentos: tabela("eventoInventarioAssentos"), eventoPedidos: tabela("eventoPedidos"), eventoItensPedido: tabela("eventoItensPedido"), eventoReservas: tabela("eventoReservas"), eventoIngressos: tabela("eventoIngressos"), eventoCheckins: tabela("eventoCheckins"), eventoOperacoesAdministrativas: tabela("eventoOperacoesAdministrativas"), eventoTransferencias: tabela("eventoTransferencias"), eventoAuditorias: tabela("eventoAuditorias"), eq: jest.fn(eq), and: jest.fn(and), or: jest.fn(and), inArray: jest.fn(inArray), asc: jest.fn((coluna: unknown) => ({ tipo: "asc", coluna })), desc: jest.fn((coluna: unknown) => ({ tipo: "desc", coluna })),
  };
});
import { MAX_PLANTA_PDF_BYTES, MapasService } from "./mapas.service";
import { StorageService } from "../../../common/storage/storage.service";

describe("MapasService", () => {
  const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };

  it("migra a sessão, recria o inventário e exclui o mapa antigo", async () => {
    const dbModule = jest.requireMock("@essencia/db") as typeof import("@essencia/db");
    const state: any = {
      event: { id: "event-1", schoolId: "school-1", defaultMapId: "map-old" },
      sessions: [{ id: "session-1", eventId: "event-1", mapId: "map-old" }],
      maps: [
        { id: "map-old", eventId: "event-1", status: "CONFIRMADO", originalFileKey: "original/old.svg", previewFileKey: "preview/old.svg" },
        { id: "map-new", eventId: "event-1", status: "CONFIRMADO" },
      ],
      seats: [{ id: "new-seat-1", mapId: "map-new", rowLabel: "A", seatNumber: "1", sellable: true }],
      inventory: [{ id: "inventory-old", sessionId: "session-1", seatId: "old-seat-1", status: "DISPONIVEL" }],
      audits: [],
      pedidos: [],
      reservas: [],
      ingressos: [],
      checkins: [],
      operacoes: [],
    };
    const rows = (table: unknown) => table === dbModule.eventos ? [state.event]
      : table === dbModule.eventoSessoes ? state.sessions
        : table === dbModule.eventoMapas ? state.maps
          : table === dbModule.eventoMapaAssentos ? state.seats
            : table === dbModule.eventoInventarioAssentos ? state.inventory
              : table === dbModule.eventoPedidos ? state.pedidos
                : table === dbModule.eventoReservas ? state.reservas
                  : table === dbModule.eventoIngressos ? state.ingressos
                    : table === dbModule.eventoCheckins ? state.checkins
                      : table === dbModule.eventoOperacoesAdministrativas ? state.operacoes
                        : table === dbModule.eventoAuditorias ? state.audits
                          : [];
    const db: any = {
      select: () => ({ from: (table: unknown) => ({ where: () => {
        const query: any = Promise.resolve(rows(table));
        query.for = () => query;
        query.orderBy = () => query;
        return query;
      } }) }),
      update: (table: unknown) => ({ set: (values: any) => {
        const apply = () => {
          if (table === dbModule.eventos) Object.assign(state.event, values);
          if (table === dbModule.eventoSessoes) state.sessions.forEach((session: any) => Object.assign(session, values));
          return table === dbModule.eventos ? [state.event] : state.sessions;
        };
        return { where: () => { apply(); return { returning: async () => apply() }; } };
      } }),
      delete: (table: unknown) => ({ where: async () => {
        if (table === dbModule.eventoInventarioAssentos) state.inventory = [];
        if (table === dbModule.eventoMapas) state.maps = state.maps.filter((map: any) => map.id !== "map-old");
        if (table === dbModule.eventoMapaAssentos) state.seats = state.seats.filter((seat: any) => seat.mapId !== "map-old");
      } }),
      insert: (table: unknown) => ({ values: (values: any) => {
        if (table === dbModule.eventoInventarioAssentos) state.inventory.push({ id: `inventory-${state.inventory.length + 1}`, ...values });
        if (table === dbModule.eventoAuditorias) state.audits.push(values);
        return { returning: async () => [{ id: `inserted-${state.audits.length}`, ...values }] };
      } }),
      transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const storage = { deleteFile: jest.fn().mockResolvedValue(undefined), deleteFileStrict: jest.fn().mockResolvedValue(undefined) };
    const maps = new MapasService({ db } as any, storage as any, {} as any);

    const result = await maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor);

    expect(result).toEqual(expect.objectContaining({
      oldMapId: "map-old",
      targetMapId: "map-new",
      migratedSessionIds: ["session-1"],
      inheritedSessionIds: [],
      inventoryCreatedCount: 1,
      deletedMap: { deleted: true, code: "DELETED" },
    }));
    expect(state.event.defaultMapId).toBe("map-new");
    expect(state.sessions[0].mapId).toBe("map-new");
    expect(state.inventory).toEqual([expect.objectContaining({ sessionId: "session-1", seatId: "new-seat-1" })]);
    expect(state.maps).toEqual([expect.objectContaining({ id: "map-new" })]);
    expect(storage.deleteFile).toHaveBeenCalledWith("original/old.svg");
    expect(storage.deleteFile).toHaveBeenCalledWith("preview/old.svg");
  });

  it("mantém a migração concluída quando a limpeza do storage falha após o commit", async () => {
    const fixture = migrationFixture();
    fixture.state.maps.find((map: any) => map.id === "map-old").originalFileKey = "original/old.svg";
    fixture.state.maps.find((map: any) => map.id === "map-old").previewFileKey = "preview/old.svg";
    fixture.storage.deleteFile.mockRejectedValue(new Error("storage indisponível"));

    await expect(fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor)).resolves.toEqual(expect.objectContaining({ deletedMap: { deleted: true, code: "DELETED" } }));
    expect(fixture.state.maps).toEqual([expect.objectContaining({ id: "map-new" })]);
    expect(fixture.state.inventory).toEqual([expect.objectContaining({ sessionId: "session-1", seatId: "new-seat-1" })]);
    expect(fixture.storage.deleteFile).toHaveBeenNthCalledWith(1, "original/old.svg");
    expect(fixture.storage.deleteFile).toHaveBeenNthCalledWith(2, "preview/old.svg");
  });

  it("deduplica chaves e registra falha de limpeza do storage sem alterar DELETED", async () => {
    const log = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const fixture = migrationFixture();
    fixture.state.maps.find((map: any) => map.id === "map-old").originalFileKey = "storage/old.svg";
    fixture.state.maps.find((map: any) => map.id === "map-old").previewFileKey = "storage/old.svg";
    fixture.storage.deleteFile.mockRejectedValue(new Error("storage indisponível"));

    await expect(fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor)).resolves.toEqual(expect.objectContaining({ deletedMap: { deleted: true, code: "DELETED" } }));
    expect(fixture.storage.deleteFile).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"operation":"migrar_sessoes_e_excluir"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"key":"storage/old.svg"'));
    log.mockRestore();
  });

  function migrationFixture(overrides: any = {}) {
    const dbModule = jest.requireMock("@essencia/db") as typeof import("@essencia/db");
    const state: any = {
      event: { id: "event-1", schoolId: "school-1", defaultMapId: "map-old" },
      sessions: [{ id: "session-1", eventId: "event-1", mapId: "map-old" }],
      maps: [
        { id: "map-old", eventId: "event-1", status: "CONFIRMADO", originalFileKey: null, previewFileKey: null },
        { id: "map-new", eventId: "event-1", status: "CONFIRMADO" },
      ],
      seats: [{ id: "old-seat-1", mapId: "map-old", sellable: true }, { id: "new-seat-1", mapId: "map-new", sellable: true }],
      inventory: [{ id: "inventory-old", sessionId: "session-1", seatId: "old-seat-1", status: "DISPONIVEL" }],
      pedidos: [], itensPedido: [], reservas: [], ingressos: [], checkins: [], operacoes: [], transferencias: [], audits: [],
      ...overrides,
    };
    const orderByCalls: unknown[][] = [];
    let inventorySelects = 0;
    const snapshot = () => ({ event: { ...state.event }, sessions: state.sessions.map((row: any) => ({ ...row })), maps: state.maps.map((row: any) => ({ ...row })), seats: state.seats.map((row: any) => ({ ...row })), inventory: state.inventory.map((row: any) => ({ ...row })), audits: state.audits.map((row: any) => ({ ...row })) });
    const restore = (saved: any) => { Object.assign(state.event, saved.event); state.sessions = saved.sessions; state.maps = saved.maps; state.seats = saved.seats; state.inventory = saved.inventory; state.audits = saved.audits; };
    const rows = (table: unknown) => table === dbModule.eventos ? [state.event]
      : table === dbModule.eventoSessoes ? state.sessions : table === dbModule.eventoMapas ? state.maps
        : table === dbModule.eventoMapaAssentos ? state.seats : table === dbModule.eventoInventarioAssentos ? state.inventory
              : table === dbModule.eventoPedidos ? state.pedidos : table === dbModule.eventoItensPedido ? state.itensPedido
                : table === dbModule.eventoReservas ? state.reservas
            : table === dbModule.eventoIngressos ? state.ingressos : table === dbModule.eventoCheckins ? state.checkins
                  : table === dbModule.eventoOperacoesAdministrativas ? state.operacoes : table === dbModule.eventoTransferencias ? state.transferencias
                    : table === dbModule.eventoAuditorias ? state.audits : [];
    const db: any = {
      select: () => ({ from: (table: unknown) => ({ where: () => {
        const selectedRows = table === dbModule.eventoInventarioAssentos && overrides.inventoryInitialOnlyOld
          ? (inventorySelects++ === 0 ? state.inventory.filter((inventory: any) => inventory.seatId === "old-seat-1") : state.inventory)
          : rows(table);
        const query: any = Promise.resolve(selectedRows);
        query.for = () => query;
        query.orderBy = (...args: unknown[]) => { orderByCalls.push(args); return query; };
        if (table === dbModule.eventoSessoes && overrides.auditAfterSessionLock) state.audits.push(overrides.auditAfterSessionLock);
        return query;
      } }) }),
      update: (table: unknown) => ({ set: (values: any) => ({ where: () => {
        if (table === dbModule.eventos) Object.assign(state.event, values);
        if (table === dbModule.eventoSessoes) state.sessions.forEach((session: any) => Object.assign(session, values));
        return { returning: async () => table === dbModule.eventos ? [state.event] : state.sessions };
      } }) }),
      delete: (table: unknown) => ({ where: async () => {
        if (table === dbModule.eventoInventarioAssentos && overrides.deleteInventoryError) throw new Error("FK evento_inventario_assentos");
        if (table === dbModule.eventoInventarioAssentos) state.inventory = [];
        if (table === dbModule.eventoMapas && overrides.deleteMapError) throw new Error("FK evento_mapas antiga");
        if (table === dbModule.eventoMapas) state.maps = state.maps.filter((map: any) => map.id !== "map-old");
      } }),
      insert: (table: unknown) => ({ values: (values: any) => {
        if (table === dbModule.eventoInventarioAssentos) state.inventory.push({ id: `inventory-${state.inventory.length + 1}`, ...values });
        if (table === dbModule.eventoAuditorias) state.audits.push(values);
        return { returning: async () => [{ id: `inserted-${state.audits.length}`, ...values }] };
      } }),
      transaction: async (callback: (tx: any) => Promise<unknown>) => { const saved = snapshot(); try { return await callback(db); } catch (error) { restore(saved); throw error; } },
    };
    const storage = { deleteFile: jest.fn().mockResolvedValue(undefined) };
    return { state, db, maps: new MapasService({ db } as any, storage as any, {} as any), storage, orderByCalls };
  }

  it("detecta sessão herdada pelo inventário e atualiza o mapa padrão", async () => {
    const fixture = migrationFixture({
      sessions: [{ id: "session-inherited", eventId: "event-1", mapId: null }],
      inventory: [{ id: "inventory-old", sessionId: "session-inherited", seatId: "old-seat-1", status: "DISPONIVEL" }],
    });
    const result = await fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor);
    expect(result.inheritedSessionIds).toEqual(["session-inherited"]);
    expect(result.migratedSessionIds).toEqual(["session-inherited"]);
    expect(fixture.state.event.defaultMapId).toBe("map-new");
    expect(fixture.state.inventory).toEqual([expect.objectContaining({ sessionId: "session-inherited", seatId: "new-seat-1" })]);
  });

  it("migra qualquer sessão cujo inventário ainda usa assento do mapa antigo", async () => {
    const fixture = migrationFixture({
      sessions: [{ id: "session-target", eventId: "event-1", mapId: "map-new" }],
      inventory: [{ id: "inventory-old", sessionId: "session-target", seatId: "old-seat-1", status: "DISPONIVEL" }],
    });
    const result = await fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor);
    expect(result.migratedSessionIds).toEqual(["session-target"]);
    expect(fixture.state.inventory).toEqual([expect.objectContaining({ sessionId: "session-target", seatId: "new-seat-1" })]);
  });

  it("ordena as sessões antes de bloquear os mapas", async () => {
    const fixture = migrationFixture();
    await fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor);
    expect(fixture.orderByCalls.length).toBeGreaterThan(0);
  });

  it("bloqueia inventário e todas as dependências antes de apagar", async () => {
    const fixture = migrationFixture();
    await fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor);
    expect(fixture.orderByCalls.length).toBeGreaterThanOrEqual(10);
  });

  it("desfaz a migração quando a exclusão do mapa falha", async () => {
    const fixture = migrationFixture({ deleteMapError: true });
    await expect(fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor)).rejects.toMatchObject({ response: { code: "MAP_DELETE_BLOCKED" } });
    expect(fixture.state.event.defaultMapId).toBe("map-old");
    expect(fixture.state.sessions[0].mapId).toBe("map-old");
    expect(fixture.state.inventory).toEqual([expect.objectContaining({ seatId: "old-seat-1" })]);
    expect(fixture.state.maps).toHaveLength(2);
  });

  it("reconsulta auditoria depois dos locks para um retry concorrente", async () => {
    const audit = { metadata: { action: "migrar_sessoes_e_excluir", targetMapId: "map-new", migratedSessionIds: ["session-1"], inheritedSessionIds: [], inventoryCreatedCount: 1, storageKeys: [] } };
    const fixture = migrationFixture({ auditAfterSessionLock: audit });
    await expect(fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor)).resolves.toEqual(expect.objectContaining({ deletedMap: { deleted: true, code: "DELETED" } }));
    expect(fixture.state.inventory).toEqual([expect.objectContaining({ seatId: "old-seat-1" })]);
  });

  it.each([
    ["pedido", "pedidos", { id: "order-1", sessionId: "session-1" }],
    ["reserva", "reservas", { id: "reservation-1", inventorySeatId: "inventory-old" }],
    ["ingresso", "ingressos", { id: "ticket-1", sessionId: "session-1" }],
    ["check-in", "checkins", { id: "checkin-1", sessionId: "session-1" }],
    ["operação administrativa", "operacoes", { id: "operation-1", sessionId: "session-1" }],
  ])("bloqueia migração quando existe %s", async (_label, property, dependency) => {
    const fixture = migrationFixture({ [property]: [dependency] });
    await expect(fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor)).rejects.toMatchObject({ response: { code: "SESSION_HAS_DEPENDENCIES" } });
    expect(fixture.state.maps).toHaveLength(2);
    expect(fixture.state.inventory).toEqual([expect.objectContaining({ seatId: "old-seat-1" })]);
  });

  it.each([
    ["item de pedido", "itensPedido", { id: "item-1", inventorySeatId: "inventory-old" }],
    ["transferência de assento", "transferencias", { id: "transfer-1", fromSeatId: "inventory-old", toSeatId: "inventory-old" }],
  ])("bloqueia migração quando existe %s referenciando inventário", async (_label, property, dependency) => {
    const fixture = migrationFixture({ [property]: [dependency] });
    await expect(fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor)).rejects.toMatchObject({ response: { code: "SESSION_HAS_DEPENDENCIES" } });
    expect(fixture.state.inventory).toEqual([expect.objectContaining({ seatId: "old-seat-1" })]);
  });

  it("bloqueia dependência ligada ao inventário alvo e preserva o estado", async () => {
    const fixture = migrationFixture({
      inventory: [
        { id: "inventory-old", sessionId: "session-1", seatId: "old-seat-1", status: "DISPONIVEL" },
        { id: "inventory-target", sessionId: "session-1", seatId: "new-seat-1", status: "DISPONIVEL" },
      ],
      reservas: [{ id: "reservation-target", inventorySeatId: "inventory-target" }],
      inventoryInitialOnlyOld: true,
    });
    const antes = {
      event: { ...fixture.state.event },
      sessions: fixture.state.sessions.map((session: any) => ({ ...session })),
      maps: fixture.state.maps.map((map: any) => ({ ...map })),
      inventory: fixture.state.inventory.map((inventory: any) => ({ ...inventory })),
    };

    await expect(fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor))
      .rejects.toMatchObject({ response: { code: "SESSION_HAS_DEPENDENCIES" } });
    expect(fixture.state.event).toEqual(antes.event);
    expect(fixture.state.sessions).toEqual(antes.sessions);
    expect(fixture.state.maps).toEqual(antes.maps);
    expect(fixture.state.inventory).toEqual(antes.inventory);
  });

  it("normaliza falha ao remover inventário sem expor o erro do driver", async () => {
    const fixture = migrationFixture({ deleteInventoryError: true });
    const error = await fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor).catch((value: unknown) => value);
    expect(error).toMatchObject({ response: { code: "MAP_DELETE_BLOCKED" } });
    expect((error as any).response).not.toHaveProperty("cause");
    expect(fixture.state.maps).toHaveLength(2);
    expect(fixture.state.inventory).toEqual([expect.objectContaining({ seatId: "old-seat-1" })]);
  });

  it("exige a seleção completa das sessões impactadas", async () => {
    const fixture = migrationFixture({ sessions: [{ id: "session-1", eventId: "event-1", mapId: "map-old" }, { id: "session-2", eventId: "event-1", mapId: "map-old" }] });
    await expect(fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new", sessionIds: ["session-1"] }, actor)).rejects.toMatchObject({ response: { code: "SESSION_SELECTION_INCOMPLETE" } });
  });

  it.each([
    ["mapa de outro evento", { maps: [{ id: "map-old", eventId: "event-1", status: "CONFIRMADO" }, { id: "map-new", eventId: "event-2", status: "CONFIRMADO" }] }, "MAP_EVENT_MISMATCH"],
    ["mapa não confirmado", { maps: [{ id: "map-old", eventId: "event-1", status: "CONFIRMADO" }, { id: "map-new", eventId: "event-1", status: "EM_REVISAO" }] }, "MAP_NOT_CONFIRMED"],
    ["mapa vazio", { seats: [{ id: "old-seat-1", mapId: "map-old", sellable: true }] }, "MAP_EMPTY"],
  ])("rejeita %s", async (_label, override, code) => {
    const fixture = migrationFixture(override);
    await expect(fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor)).rejects.toMatchObject({ response: { code } });
  });

  it("rejeita mapas iguais e retorna a auditoria no retry", async () => {
    const fixture = migrationFixture();
    await expect(fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-old" }, actor)).rejects.toMatchObject({ response: { code: "SAME_MAP" } });
    const first = await fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor);
    const second = await fixture.maps.migrarSessoesEExcluir("event-1", "map-old", { targetMapId: "map-new" }, actor);
    expect(second).toEqual(first);
    expect(fixture.state.inventory).toHaveLength(1);
  });
  it("mantém StorageService como token de DI mesmo sendo opcional", () => {
    const selfParamTypes = Reflect.getMetadata("self:paramtypes", MapasService) as Array<{ index: number; param: unknown }>;
    expect(selfParamTypes).toEqual(expect.arrayContaining([{ index: 1, param: StorageService }]));
  });
  const PDF = Buffer.from("%PDF-1.7 planta");
  const arquivoPdf = (buffer: Buffer = PDF, mimetype = "application/pdf") => ({ filename: "planta.pdf", mimetype, toBuffer: jest.fn().mockResolvedValue(buffer) }) as any;
  const propostaFalsa = (lugares = 3, pontos = 1) => ({ versao: 1, revisao: 0, pagina: { numero: 1, largura: 8420, altura: 5950 }, lugares: Array.from({ length: lugares }, (_, i) => ({ id: `l${i}` })), rotulos: [], elementos: [], legenda: [], pontos: Array.from({ length: pontos }, (_, i) => ({ id: `p${i}` })) }) as any;

  function importacaoFixture(overrides: { maps?: any[]; sessions?: any[]; event?: any; gerar?: jest.Mock } = {}) {
    const dbModule = jest.requireMock("@essencia/db") as any;
    (dbModule.desc as jest.Mock).mockImplementation(() => "desc");
    const ordem: string[] = [];
    const state: any = {
      event: { id: "event-1", schoolId: "school-1", defaultMapId: null, ...overrides.event },
      maps: overrides.maps ?? [],
      sessions: overrides.sessions ?? [],
      imports: [] as any[],
      audits: [] as any[],
      deteccoes: [] as any[],
      updates: [] as any[],
    };
    const rows = (table: unknown) => table === dbModule.eventos ? [state.event] : table === dbModule.eventoMapas ? state.maps : table === dbModule.eventoSessoes ? state.sessions : table === dbModule.eventoImportacoesMapa ? state.imports : [];
    const select = () => ({ from: (table: unknown) => {
      const consulta: any = { where: () => consulta, orderBy: (ordenacao: unknown) => { if (ordenacao === "desc") return Promise.resolve([...rows(table)].sort((x: any, y: any) => y.version - x.version)); return Promise.resolve(rows(table)); }, then: (resolve: any, reject: any) => Promise.resolve(rows(table)).then(resolve, reject), for: () => consulta };
      return consulta;
    } });
    const insert = (table: unknown) => ({ values: (values: any) => {
      const gravar = () => {
        if (table === dbModule.eventoMapas) { const row = { id: `map-${state.maps.length + 1}`, ...values }; state.maps.push(row); return [row]; }
        if (table === dbModule.eventoImportacoesMapa) { const row = { id: `imp-${state.imports.length + 1}`, ...values }; state.imports.push(row); return [row]; }
        if (table === dbModule.eventoDeteccoesMapa) state.deteccoes.push(values);
        if (table === dbModule.eventoAuditorias) state.audits.push(values);
        return [];
      };
      return { returning: async () => gravar(), then: (resolve: any, reject: any) => Promise.resolve(gravar()).then(resolve, reject) };
    } });
    const update = (table: unknown) => ({ set: (values: any) => ({ where: () => {
      state.updates.push({ table, values });
      return { returning: async () => [], then: (resolve: any, reject: any) => Promise.resolve([]).then(resolve, reject) };
    } }) });
    const db: any = { select, insert, update, delete: () => ({ where: async () => [] }) };
    const gerar = overrides.gerar ?? jest.fn().mockImplementation(async () => { ordem.push("gerar"); return propostaFalsa(); });
    const storage = {
      uploadMapBuffer: jest.fn().mockImplementation(async () => { ordem.push("upload"); return { key: "private/planta.pdf" }; }),
      deleteFileStrict: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getObject: jest.fn(),
    };
    const maps = new MapasService({ db } as any, storage as any, { gerar } as any);
    return { maps, state, storage, gerar, ordem, dbModule };
  }

  it("importa o PDF: gera a proposta antes do upload e grava EM_REVISAO com a proposta", async () => {
    const fx = importacaoFixture();
    const result = await fx.maps.importar("event-1", arquivoPdf(), actor);
    expect(fx.ordem).toEqual(["gerar", "upload"]);
    expect(fx.gerar).toHaveBeenCalledWith(PDF, undefined);
    expect(fx.storage.uploadMapBuffer).toHaveBeenCalledWith(PDF, "planta.pdf", "application/pdf", "eventos/event-1/mapas/originais");
    expect(result).toEqual({ importId: "imp-1", mapId: "map-1", status: "EM_REVISAO", proposalCount: 3, conflictCount: 1 });
    expect(fx.state.maps[0]).toMatchObject({ version: 1, status: "EM_REVISAO", originalFileKey: "private/planta.pdf", originalMimeType: "application/pdf" });
    expect(fx.state.imports[0]).toMatchObject({ detector: "pdf-vetorial", detectorVersion: "2", status: "EM_REVISAO", proposalCount: 3, conflictCount: 1, proposta: expect.objectContaining({ versao: 1 }) });
    expect(fx.state.deteccoes).toHaveLength(0);
    expect(fx.state.audits[0]).toMatchObject({ metadata: expect.objectContaining({ action: "importar" }) });
  });

  it("PDF acima do limite é recusado sem chamar o gerador nem o storage", async () => {
    const fx = importacaoFixture();
    const grande = Buffer.concat([Buffer.from("%PDF-1.7 "), Buffer.alloc(MAX_PLANTA_PDF_BYTES)]);
    await expect(fx.maps.importar("event-1", arquivoPdf(grande), actor)).rejects.toMatchObject({ response: { code: "MAP_TOO_LARGE", message: "A planta passa de 10 MB. Envie o PDF exportado do programa de desenho, sem imagens." } });
    expect(fx.gerar).not.toHaveBeenCalled();
    expect(fx.storage.uploadMapBuffer).not.toHaveBeenCalled();
  });

  it("traduz o corte do multipart (FST_REQ_FILE_TOO_LARGE) em MAP_TOO_LARGE", async () => {
    const fx = importacaoFixture();
    const arquivo = arquivoPdf();
    arquivo.toBuffer.mockRejectedValue(Object.assign(new Error("request file too large"), { code: "FST_REQ_FILE_TOO_LARGE" }));
    await expect(fx.maps.importar("event-1", arquivo, actor)).rejects.toMatchObject({ response: { code: "MAP_TOO_LARGE" } });
    expect(fx.gerar).not.toHaveBeenCalled();
  });

  it("aceita PDF identificado só pelo começo do arquivo", async () => {
    const fx = importacaoFixture();
    await expect(fx.maps.importar("event-1", arquivoPdf(PDF, "application/octet-stream"), actor)).resolves.toMatchObject({ status: "EM_REVISAO" });
  });

  it("recusa arquivo que não é PDF sem enviar ao storage", async () => {
    const fx = importacaoFixture();
    await expect(fx.maps.importar("event-1", arquivoPdf(Buffer.from("<svg/>"), "image/svg+xml"), actor)).rejects.toMatchObject({ response: { code: "INVALID_MAP_TYPE", message: "Envie a planta em PDF." } });
    expect(fx.gerar).not.toHaveBeenCalled();
    expect(fx.storage.uploadMapBuffer).not.toHaveBeenCalled();
  });

  it("repassa a página escolhida ao gerador", async () => {
    const fx = importacaoFixture();
    await fx.maps.importar("event-1", arquivoPdf(), actor, 2);
    expect(fx.gerar).toHaveBeenCalledWith(PDF, 2);
  });

  it("erro do gerador não envia nada ao storage", async () => {
    const erro = new BadRequestException({ code: "PDF_PAGINA_OBRIGATORIA", message: "Escolha a página", details: { paginas: [1, 2] } });
    const fx = importacaoFixture({ gerar: jest.fn().mockRejectedValue(erro) });
    await expect(fx.maps.importar("event-1", arquivoPdf(), actor)).rejects.toBe(erro);
    expect(fx.storage.uploadMapBuffer).not.toHaveBeenCalled();
    expect(fx.state.maps).toHaveLength(0);
  });

  it("apaga o original do storage quando a gravação falha", async () => {
    const fx = importacaoFixture();
    jest.spyOn(fx.maps as any, "transaction").mockRejectedValue(new Error("falha de banco"));
    await expect(fx.maps.importar("event-1", arquivoPdf(), actor)).rejects.toThrow("falha de banco");
    expect(fx.storage.deleteFileStrict).toHaveBeenCalledWith("private/planta.pdf");
  });

  it("arquiva a proposta em revisão anterior ao importar outra", async () => {
    const fx = importacaoFixture({ maps: [
      { id: "map-a", eventId: "event-1", version: 1, status: "EM_REVISAO" },
      { id: "map-b", eventId: "event-1", version: 2, status: "EM_REVISAO" },
      { id: "map-c", eventId: "event-1", version: 3, status: "CONFIRMADO" },
    ], sessions: [{ id: "s1", eventId: "event-1", mapId: "map-b" }] });
    const result = await fx.maps.importar("event-1", arquivoPdf(), actor);
    expect(fx.state.maps.find((m: any) => m.id === result.mapId)).toMatchObject({ version: 4, status: "EM_REVISAO" });
    const arquivados = fx.state.updates.filter((u: any) => u.table === fx.dbModule.eventoMapas && u.values.status === "ARQUIVADO");
    expect(arquivados).toHaveLength(1);
  });

  it("lista as versões do evento da mais nova para a mais antiga e respeita a escola", async () => {
    const maps = [
      { id: "m1", eventId: "event-1", version: 1, status: "ARQUIVADO", originalFileName: "a.pdf", createdAt: new Date("2026-01-01"), confirmedAt: null, originalFileKey: "k1" },
      { id: "m2", eventId: "event-1", version: 2, status: "CONFIRMADO", originalFileName: "b.pdf", createdAt: new Date("2026-02-01"), confirmedAt: new Date("2026-02-02"), originalFileKey: "k2" },
    ];
    const fx = importacaoFixture({ maps });
    const lista = await fx.maps.listar("event-1", actor);
    expect(lista).toEqual([
      { id: "m2", version: 2, status: "CONFIRMADO", originalFileName: "b.pdf", createdAt: new Date("2026-02-01"), confirmedAt: new Date("2026-02-02") },
      { id: "m1", version: 1, status: "ARQUIVADO", originalFileName: "a.pdf", createdAt: new Date("2026-01-01"), confirmedAt: null },
    ]);
    const outra = importacaoFixture({ maps, event: { schoolId: "school-2" } });
    await expect(outra.maps.listar("event-1", actor)).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
  });

  it("revisão devolve a proposta da importação", async () => {
    const proposta = propostaFalsa();
    const fx = importacaoFixture({ maps: [{ id: "m1", eventId: "event-1", version: 1, status: "EM_REVISAO" }] });
    fx.state.imports.push({ id: "imp-1", mapId: "m1", proposta });
    const revisao = await fx.maps.revisao("event-1", "m1", actor);
    expect(revisao.proposta).toBe(proposta);
    expect(revisao.import).toMatchObject({ id: "imp-1" });
    expect(revisao).not.toHaveProperty("detections");
  });

  it("original devolve o arquivo do storage com o content-type e recusa outra escola", async () => {
    const maps = [{ id: "m1", eventId: "event-1", version: 1, originalFileKey: "private/planta.pdf", originalMimeType: "application/pdf" }];
    const fx = importacaoFixture({ maps });
    const corpo = { pipe: jest.fn() };
    fx.storage.getObject.mockResolvedValue({ Body: corpo, ContentType: "application/octet-stream", ContentLength: 1234 });
    await expect(fx.maps.obterOriginal("event-1", "m1", actor)).resolves.toEqual({ body: corpo, contentType: "application/pdf", contentLength: 1234 });
    expect(fx.storage.getObject).toHaveBeenCalledWith("private/planta.pdf");
    const outra = importacaoFixture({ maps, event: { schoolId: "school-2" } });
    await expect(outra.maps.obterOriginal("event-1", "m1", actor)).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
    expect(outra.storage.getObject).not.toHaveBeenCalled();
  });

  it("original só serve PDF: versão antiga em SVG ou PNG responde 404 sem ler o storage", async () => {
    for (const originalMimeType of ["image/svg+xml", "image/png", null]) {
      const fx = importacaoFixture({ maps: [{ id: "m1", eventId: "event-1", version: 1, originalFileKey: "private/antiga", originalMimeType }] });
      await expect(fx.maps.obterOriginal("event-1", "m1", actor)).rejects.toMatchObject({
        status: 404,
        response: { code: "MAP_ORIGINAL_NOT_FOUND", message: "Planta original indisponível." },
      });
      expect(fx.storage.getObject).not.toHaveBeenCalled();
    }
  });

  it("original ausente no storage (NoSuchKey ou 404 do S3) responde MAP_ORIGINAL_NOT_FOUND, sem erro cru", async () => {
    const maps = [{ id: "m1", eventId: "event-1", version: 1, originalFileKey: "private/planta.pdf", originalMimeType: "application/pdf" }];
    for (const falha of [Object.assign(new Error("x"), { name: "NoSuchKey" }), Object.assign(new Error("x"), { $metadata: { httpStatusCode: 404 } })]) {
      const fx = importacaoFixture({ maps });
      fx.storage.getObject.mockRejectedValue(falha);
      await expect(fx.maps.obterOriginal("event-1", "m1", actor)).rejects.toMatchObject({ status: 404, response: { code: "MAP_ORIGINAL_NOT_FOUND" } });
    }
    const outra = importacaoFixture({ maps });
    const queda = new Error("rede caiu");
    outra.storage.getObject.mockRejectedValue(queda);
    await expect(outra.maps.obterOriginal("event-1", "m1", actor)).rejects.toBe(queda);
  });

  it("rejeita confirmação sem assentos", async () => {
    const db: any = { select: () => ({ from: () => ({ where: async () => [{ id: "event-1", schoolId: "school-1" }] }) }) };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    await expect((maps as any).gravarConfirmacao(db, { id: "map-1" }, { seats: [], actor })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("gera inventário por sessão, bloqueia assentos não vendáveis e preserva estados existentes", async () => {
    const dbModule = jest.requireMock("@essencia/db") as typeof import("@essencia/db");
    const sessions = [
      { id: "session-inherited", eventId: "event-1", mapId: null },
      { id: "session-specific", eventId: "event-1", mapId: "map-1" },
      { id: "session-other-map", eventId: "event-1", mapId: "map-2" },
    ];
    const mapSeats = [
      { id: "seat-1", mapId: "map-1", rowLabel: "A", seatNumber: "1", sellable: true },
      { id: "seat-2", mapId: "map-1", rowLabel: "A", seatNumber: "2", sellable: false },
    ];
    const existingInventory = [
      { id: "inventory-1", sessionId: "session-inherited", seatId: "seat-1", status: "RESERVADO" },
      { id: "inventory-2", sessionId: "session-specific", seatId: "seat-2", status: "BLOQUEADO", blockedReason: "cadeirante" },
    ];
    const inserted: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    let selectCall = 0;
    const select = jest.fn(() => ({
      from: () => ({
        where: async () => {
          selectCall += 1;
          if (selectCall === 1) return [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-1" }];
          if (selectCall === 2) return [{ id: "map-1", eventId: "event-1", status: "EM_REVISAO" }];
          if (selectCall === 3) return [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-1" }];
          if (selectCall === 4) return [{ id: "map-1", eventId: "event-1", status: "EM_REVISAO" }];
          if (selectCall === 5) return [{ id: "import-1" }];
          if (selectCall === 6) return [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-1" }];
          if (selectCall === 7) return sessions;
          if (selectCall === 8) return mapSeats;
          if (selectCall === 9) return existingInventory.filter((item) => item.sessionId === "session-inherited");
          if (selectCall === 10) return existingInventory.filter((item) => item.sessionId === "session-specific");
          return [];
        },
      }),
    }));
    const insert = jest.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserted.push({ table, values });
        return { returning: async () => [{ id: `generated-${inserted.length}`, ...values }] };
      },
    }));
    const db: any = {
      select,
      insert,
      delete: () => ({ where: async () => undefined }),
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [{ id: "map-1", status: "CONFIRMADO" }] }) }) }),
      transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const maps = new MapasService({ db } as any, undefined, {} as any);

    const result = await (maps as any).gravarConfirmacao(db, { id: "map-1" }, {
      seats: mapSeats.map((seat) => ({ rowLabel: seat.rowLabel, seatNumber: seat.seatNumber, x: 1, y: 1, sellable: seat.sellable })),
      actor,
    });

    expect(inserted.filter((item) => item.table === dbModule.eventoInventarioAssentos)).toHaveLength(0);
    expect(result.map).toBeDefined();
  });

  it("adia o inventário do primeiro mapa para a substituição e mantém os assentos disponíveis", async () => {
    const dbModule = jest.requireMock("@essencia/db") as typeof import("@essencia/db");
    const state: any = {
      event: { id: "event-1", schoolId: "school-1", defaultMapId: null },
      map: { id: "map-primeiro", eventId: "event-1", status: "EM_REVISAO", previewFileKey: null },
      seats: [] as any[],
      sessions: [{ id: "sessao-herdada", eventId: "event-1", mapId: null }],
      inventory: [] as any[],
      audits: [] as any[],
    };
    const rows = (table: unknown) => {
      if (table === dbModule.eventos) return [state.event];
      if (table === dbModule.eventoMapas) return [state.map];
      if (table === dbModule.eventoSessoes) return state.sessions;
      if (table === dbModule.eventoMapaAssentos) return state.seats;
      if (table === dbModule.eventoInventarioAssentos) return state.inventory.filter((item: any) => item.sessionId === "sessao-herdada");
      if (table === dbModule.eventoImportacoesMapa) return [];
      if (table === dbModule.eventoAuditorias) return state.audits;
      return [];
    };
    const db: any = {
      select: () => ({ from: (table: unknown) => ({ where: () => {
        const query: any = Promise.resolve(rows(table));
        query.for = () => Promise.resolve(rows(table));
        return query;
      } }) }),
      delete: () => ({ where: async () => undefined }),
      update: (table: unknown) => ({ set: (values: any) => ({ where: () => ({ returning: async () => {
        if (table === dbModule.eventoMapas) Object.assign(state.map, values);
        if (table === dbModule.eventos) Object.assign(state.event, values);
        return [table === dbModule.eventoMapas ? state.map : state.event];
      } }) }) }),
      insert: (table: unknown) => ({ values: (values: any) => {
        if (table === dbModule.eventoMapaAssentos) state.seats.push({ id: `seat-${state.seats.length + 1}`, ...values });
        if (table === dbModule.eventoInventarioAssentos) state.inventory.push({ id: `inventory-${state.inventory.length + 1}`, ...values });
        if (table === dbModule.eventoAuditorias) state.audits.push(values);
        return { returning: async () => [{ id: `inserted-${state.audits.length}` }] };
      } }),
      transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    const seats = [{ rowLabel: "A", seatNumber: "1", x: 1, y: 1, sellable: true }];

    const confirmed = await (maps as any).gravarConfirmacao(db, state.map, { seats, actor });
    const replaced = await maps.substituirMapaPadrao("event-1", "map-primeiro", actor);

    expect(confirmed.map.status).toBe("CONFIRMADO");
    expect(replaced.previousMapArchive).toEqual({ archived: false, code: "NO_PREVIOUS_MAP" });
    expect(replaced.inventoryCreatedCount).toBe(1);
    expect(state.inventory).toEqual([expect.objectContaining({ status: "DISPONIVEL", sessionId: "sessao-herdada" })]);
  });

  it("rejeita reconfirmação e arquivamento inválido", async () => {
    const db: any = {
      select: () => ({ from: () => ({ where: async () => [{ id: "map-1", eventId: "event-1", schoolId: "school-1", status: "ARQUIVADO" }] }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    await expect(maps.arquivar("event-1", "map-1", actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("impede arquivamento de mapa referenciado pelo evento", async () => {
    const update = jest.fn();
    const db: any = { select: () => ({ from: () => ({ where: async () => [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-1" }] }) }), update };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    await expect(maps.arquivar("event-1", "map-1", actor)).rejects.toMatchObject({ response: { code: "MAP_IN_USE" } });
    expect(update).not.toHaveBeenCalled();
  });

  it("impede arquivamento de mapa referenciado por uma sessão", async () => {
    const update = jest.fn();
    let call = 0;
    const db: any = {
      select: () => ({ from: () => ({ where: async () => {
        call += 1;
        return call === 1
          ? [{ id: "event-1", schoolId: "school-1", defaultMapId: null }]
          : [{ mapId: "map-1" }];
      } }) }),
      update,
    };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    await expect(maps.arquivar("event-1", "map-1", actor)).rejects.toMatchObject({ response: { code: "MAP_IN_USE" } });
    expect(update).not.toHaveBeenCalled();
  });

  it("arquiva mapa confirmado sem referência pública", async () => {
    let call = 0;
    const returning = jest.fn().mockResolvedValue([{ id: "map-1", eventId: "event-1", status: "ARQUIVADO" }]);
    const update = jest.fn(() => ({ set: () => ({ where: () => ({ returning }) }) }));
    const db: any = {
      select: () => ({ from: () => ({ where: async () => {
        call += 1;
        return call === 1
          ? [{ id: "event-1", schoolId: "school-1", defaultMapId: null }]
          : call === 2
            ? []
            : [{ id: "map-1", eventId: "event-1", status: "CONFIRMADO", previewFileKey: null }];
      } }) }),
      update,
      insert: () => ({ values: () => undefined }),
    };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    const result = await maps.arquivar("event-1", "map-1", actor);
    expect(result.status).toBe("ARQUIVADO");
    expect(update).toHaveBeenCalled();
  });

  it("serializa arquivamento pelo lock do evento e das sessões", async () => {
    const dbModule = jest.requireMock("@essencia/db") as typeof import("@essencia/db");
    const locks: Array<{ table: unknown; mode: string }> = [];
    const rows = new Map<unknown, any[]>([
      [dbModule.eventos, [{ id: "event-1", schoolId: "school-1", defaultMapId: null }]],
      [dbModule.eventoSessoes, []],
      [dbModule.eventoMapas, [{ id: "map-1", eventId: "event-1", status: "CONFIRMADO", previewFileKey: null }]],
    ]);
    const db: any = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            for: jest.fn((mode: string) => {
              locks.push({ table, mode });
              return rows.get(table) ?? [];
            }),
            then: (resolve: (value: any[]) => unknown) => Promise.resolve(rows.get(table) ?? []).then(resolve),
          }),
        }),
      }),
      update: (table: unknown) => ({ set: () => ({ where: () => ({ returning: async () => [{ id: table === dbModule.eventoMapas ? "map-1" : "event-1", status: "ARQUIVADO" }] }) }) }),
      insert: () => ({ values: () => ({ returning: async () => [{ id: "audit-1" }] }) }),
      transaction: async (fn: any) => fn(db),
    };
    await new MapasService({ db } as any, undefined, {} as any).arquivar("event-1", "map-1", actor);
    expect(locks).toHaveLength(3);
    expect(locks.every((lock) => lock.mode === "update")).toBe(true);
  });

  it("trava o evento e depois relê as sessões antes de classificar herdadas", async () => {
    const dbModule = jest.requireMock("@essencia/db") as typeof import("@essencia/db");
    const locks: unknown[] = [];
    let mapReads = 0;
    const db: any = {
      select: () => ({ from: (table: unknown) => ({ where: () => {
        const query: any = Promise.resolve(
          table === dbModule.eventos
            ? [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" }]
            : table === dbModule.eventoSessoes
              ? [{ id: "sessao-herdada", eventId: "event-1", mapId: null }]
              : table === dbModule.eventoMapas
                ? [mapReads++ === 0 ? { id: "map-novo", eventId: "event-1", status: "CONFIRMADO" } : { id: "map-antigo", eventId: "event-1", status: "CONFIRMADO", previewFileKey: null }]
                : table === dbModule.eventoMapaAssentos
                  ? [{ id: "seat-novo", mapId: "map-novo", sellable: true }]
                  : []
        );
        query.for = (mode: string) => { locks.push({ table, mode }); return query; };
        return query;
      } }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [{ id: "event-1" }] }) }) }),
      insert: () => ({ values: () => ({ returning: async () => [{ id: "audit-1" }] }) }),
      transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    (maps as any).sincronizarInventarioMapa = jest.fn().mockResolvedValue({ inventorySessionIds: ["sessao-herdada"], inventoryCreatedCount: 1 });

    await maps.substituirMapaPadrao("event-1", "map-novo", actor);

    expect(locks.slice(0, 3)).toEqual([
      { table: dbModule.eventos, mode: "update" },
      { table: dbModule.eventoSessoes, mode: "update" },
      { table: dbModule.eventoMapas, mode: "update" },
    ]);
  });

  describe("editar e publicar a proposta", () => {
    const propostaValida = (sobrescrever: any = {}) => ({
      versao: 1, revisao: 2, pagina: { numero: 1, largura: 8420, altura: 5950 },
      lugares: [
        { id: "l1", fileira: "A", numero: "1", x: 1000, y: 2000, largura: 100, altura: 80, rotacao: 0, blocoId: "b1", cor: "#fff", categoriaManual: null, acessoExternoManual: null, vender: true, origem: "GERADOR" },
        { id: "l2", fileira: "A", numero: "2", x: 1200, y: 2000, largura: 100, altura: 80, rotacao: 15, blocoId: "b1", cor: "#fff", categoriaManual: "OBESO", acessoExternoManual: true, vender: true, origem: "GERADOR" },
      ],
      rotulos: [{ fileira: "A", x: 800, y: 2000 }], elementos: [{ tipo: "PALCO", texto: "Palco", x: 4000, y: 300 }],
      legenda: [{ cor: "#fff", texto: "Comum", quantidade: 2, categoria: "COMUM", acessoExterno: false, confirmada: true }],
      pontos: [], ...sobrescrever,
    });

    function fixture(opcoes: { proposta?: any; statusMapa?: string; semImportacao?: boolean; outraAbaAposPrimeiraLeitura?: boolean; pedidos?: any[]; operacoes?: any[]; ingressos?: any[]; checkins?: any[]; sessoes?: any[]; inventario?: any[]; itens?: any[]; reservas?: any[]; injetarVendaNaAtualizacaoEvento?: boolean } = {}) {
      const dbModule = jest.requireMock("@essencia/db") as any;
      const state: any = {
        event: { id: "event-1", schoolId: "school-1", defaultMapId: null },
        map: { id: "map-1", eventId: "event-1", status: opcoes.statusMapa ?? "EM_REVISAO" },
        sessions: opcoes.sessoes ?? [],
        pedidos: opcoes.pedidos ?? [],
        operacoes: opcoes.operacoes ?? [],
        ingressos: opcoes.ingressos ?? [],
        checkins: opcoes.checkins ?? [],
        inventory: opcoes.inventario ?? [],
        itens: opcoes.itens ?? [],
        reservas: opcoes.reservas ?? [],
        imp: opcoes.semImportacao ? null : { id: "imp-1", mapId: "map-1", status: "EM_REVISAO", proposta: opcoes.proposta === undefined ? propostaValida() : opcoes.proposta },
        seats: [] as any[], audits: [] as any[], mapUpdates: [] as any[], impUpdates: [] as any[], locks: [] as unknown[],
      };
      let outraAba = opcoes.outraAbaAposPrimeiraLeitura ?? false;
      const rows = (table: unknown) => {
        if (table === dbModule.eventoImportacoesMapa && state.imp) {
          const lida = state.imp;
          if (outraAba) { outraAba = false; state.imp = { ...lida, proposta: { ...lida.proposta, revisao: lida.proposta.revisao + 1 } }; }
          return [lida];
        }
        return table === dbModule.eventos ? [state.event]
          : table === dbModule.eventoMapas ? [state.map]
            : table === dbModule.eventoSessoes ? state.sessions
              : table === dbModule.eventoMapaAssentos ? state.seats
                  : table === dbModule.eventoInventarioAssentos ? state.inventory
                    : table === dbModule.eventoItensPedido ? state.itens
                      : table === dbModule.eventoReservas ? state.reservas
              : table === dbModule.eventoPedidos ? state.pedidos
                : table === dbModule.eventoIngressos ? state.ingressos
                  : table === dbModule.eventoCheckins ? state.checkins
                    : table === dbModule.eventoOperacoesAdministrativas ? state.operacoes
                  : [];
      };
      const db: any = {
        select: () => ({ from: (table: unknown) => { const q: any = { where: () => q, for: () => { state.locks.push(table); return q; }, then: (ok: any, ko: any) => Promise.resolve(rows(table)).then(ok, ko) }; return q; } }),
        insert: (table: unknown) => ({ values: (values: any) => {
          if (table === dbModule.eventoMapaAssentos) state.seats.push(values);
          if (table === dbModule.eventoAuditorias) state.audits.push(values);
          return { returning: async () => [] };
        } }),
        delete: () => ({ where: async () => undefined }),
        update: (table: unknown) => ({ set: (values: any) => ({ where: () => {
          if (table === dbModule.eventos) {
            Object.assign(state.event, values);
            if (opcoes.injetarVendaNaAtualizacaoEvento && !state.pedidos.length) {
              state.pedidos.push({ id: "pedido-pago", eventId: "event-1", sessionId: state.sessions[0]?.id, status: "CONFIRMADO", expiresAt: null });
              state.itens.push({ id: "item-pago", orderId: "pedido-pago", inventorySeatId: state.inventory[0]?.id });
            }
          }
          if (table === dbModule.eventoMapas) { Object.assign(state.map, values); state.mapUpdates.push(values); }
          if (table === dbModule.eventoImportacoesMapa) { Object.assign(state.imp, values); state.impUpdates.push(values); }
          const resultado = table === dbModule.eventoMapas ? [state.map] : [];
          return { returning: async () => resultado, then: (ok: any, ko: any) => Promise.resolve(resultado).then(ok, ko) };
        } }) }),
        transaction: async (fn: any) => {
          const snapshot = structuredClone(state);
          try { return await fn(db); } catch (error) {
            for (const key of Object.keys(state)) {
              if (Array.isArray(state[key])) state[key].splice(0, state[key].length, ...snapshot[key]);
              else if (state[key] && typeof state[key] === "object" && snapshot[key] && typeof snapshot[key] === "object") Object.assign(state[key], snapshot[key]);
              else state[key] = snapshot[key];
            }
            throw error;
          }
        },
      };
      const maps = new MapasService({ db } as any, undefined, {} as any);
      return { maps, state };
    }
    const editar = (revisaoBase: number, operacoes: any[]) => ({ revisaoBase, operacoes });

    it("editarProposta aplica as operações, grava a nova revisão e audita", async () => {
      const fx = fixture();
      const operacoes = [{ tipo: "EDITAR_LUGAR", lugarId: "l1", vender: false }];
      const nova = await fx.maps.editarProposta("event-1", "map-1", editar(2, operacoes) as any, actor);
      expect(nova.revisao).toBe(3);
      expect(nova.lugares[0]).toMatchObject({ id: "l1", vender: false });
      expect(fx.state.imp.proposta).toBe(nova);
      expect(fx.state.audits).toEqual([expect.objectContaining({ resourceId: "map-1", metadata: { action: "editar_proposta", revisao: 3, operacoes } })]);
    });

    it("editarProposta recusa revisão desatualizada sem gravar (duas abas)", async () => {
      const fx = fixture({ proposta: propostaValida({ revisao: 5 }) });
      await expect(fx.maps.editarProposta("event-1", "map-1", editar(4, [{ tipo: "CONFERIR_PONTO", pontoId: "p1" }]) as any, actor))
        .rejects.toMatchObject({ response: { code: "PROPOSTA_DESATUALIZADA", message: "Esta conferência foi alterada em outra aba. Recarregue para continuar." } });
      expect(fx.state.impUpdates).toHaveLength(0);
      expect(fx.state.audits).toHaveLength(0);
    });

    it("editarProposta recusa mapa fora de revisão e operação inválida", async () => {
      const confirmado = fixture({ statusMapa: "CONFIRMADO" });
      await expect(confirmado.maps.editarProposta("event-1", "map-1", editar(2, [{ tipo: "EXCLUIR_LUGAR", lugarId: "l1" }]) as any, actor)).rejects.toMatchObject({ response: { code: "MAP_NOT_IN_REVIEW" } });
      const semProposta = fixture({ proposta: null });
      await expect(semProposta.maps.editarProposta("event-1", "map-1", editar(0, [{ tipo: "EXCLUIR_LUGAR", lugarId: "l1" }]) as any, actor)).rejects.toMatchObject({ response: { code: "PROPOSTA_INEXISTENTE" } });
      const invalida = fixture();
      await expect(invalida.maps.editarProposta("event-1", "map-1", editar(2, [{ tipo: "EXCLUIR_LUGAR", lugarId: "nao-existe" }]) as any, actor))
        .rejects.toMatchObject({ response: { code: "PROPOSTA_OPERACAO_INVALIDA", message: expect.stringContaining("nao-existe") } });
      expect(invalida.state.impUpdates).toHaveLength(0);
      expect(invalida.state.audits).toHaveLength(0);
    });

    it("editarProposta relê dentro da transação: revisão trocada por outra aba não é sobrescrita", async () => {
      const fx = fixture({ outraAbaAposPrimeiraLeitura: true });
      await expect(fx.maps.editarProposta("event-1", "map-1", editar(2, [{ tipo: "EDITAR_LUGAR", lugarId: "l1", vender: false }]) as any, actor))
        .rejects.toMatchObject({ response: { code: "PROPOSTA_DESATUALIZADA" } });
      expect(fx.state.impUpdates).toHaveLength(0);
      expect(fx.state.audits).toHaveLength(0);
    });

    it("publicar valida a revisão na importação já travada", async () => {
      const fx = fixture({ proposta: propostaValida({ revisao: 5 }) });
      await expect(fx.maps.publicar("event-1", "map-1", { revisaoBase: 2 }, actor)).rejects.toMatchObject({ response: { code: "PROPOSTA_DESATUALIZADA" } });
      expect(fx.state.seats).toHaveLength(0);
      expect(fx.state.mapUpdates).toHaveLength(0);
      expect(fx.state.audits).toHaveLength(0);
    });

    it("publicar recusa proposta com pendências e devolve a lista", async () => {
      const fx = fixture({ proposta: propostaValida({ pontos: [{ id: "p1", tipo: "SEM_FILEIRA", mensagem: "Sem fileira", lugarIds: ["l1"], conferido: false }] }) });
      await expect(fx.maps.publicar("event-1", "map-1", { revisaoBase: 2 }, actor)).rejects.toMatchObject({
        response: { code: "PROPOSTA_COM_PENDENCIAS", message: "Ainda há pontos para conferir antes de publicar.", details: { pendencias: [expect.objectContaining({ tipo: "PONTO_NAO_CONFERIDO" })] } },
      });
      expect(fx.state.seats).toHaveLength(0);
      expect(fx.state.mapUpdates).toHaveLength(0);
    });

    it("publicar recusa revisão desatualizada e proposta ausente", async () => {
      const fx = fixture();
      await expect(fx.maps.publicar("event-1", "map-1", { revisaoBase: 1 }, actor)).rejects.toMatchObject({ response: { code: "PROPOSTA_DESATUALIZADA" } });
      const vazio = fixture({ proposta: null });
      await expect(vazio.maps.publicar("event-1", "map-1", { revisaoBase: 0 }, actor)).rejects.toMatchObject({ response: { code: "PROPOSTA_INEXISTENTE" } });
      expect(fx.state.seats).toHaveLength(0);
    });

    it("publicar grava assentos com metadados, layout e CONFIRMADO com o motivo opcional", async () => {
      const fx = fixture();
      const resultado = await fx.maps.publicar("event-1", "map-1", { revisaoBase: 2, motivo: "Conferido com a produção" }, actor);
      expect(fx.state.seats).toEqual([
        expect.objectContaining({ mapId: "map-1", rowLabel: "A", seatNumber: "1", x: 950, y: 1960, width: 100, height: 80, category: "COMUM", accessible: false, sellable: true, metadata: { rotacao: 0, blocoId: "b1", acessoExterno: false, origem: "GERADOR" } }),
        expect.objectContaining({ rowLabel: "A", seatNumber: "2", x: 1120, y: 1960, width: 160, category: "OBESO", accessible: true, metadata: { rotacao: 15, blocoId: "b1", acessoExterno: true, origem: "GERADOR" } }),
      ]);
      expect(fx.state.mapUpdates[0]).toMatchObject({ status: "CONFIRMADO", layout: { versao: 1, largura: 8420, altura: 5950, rotulos: [{ fileira: "A", x: 800, y: 2000 }], elementos: [expect.objectContaining({ tipo: "PALCO" })] } });
      expect(fx.state.audits).toEqual([expect.objectContaining({ metadata: expect.objectContaining({ action: "publicar", motivo: "Conferido com a produção" }) })]);
      expect(resultado.map.status).toBe("CONFIRMADO");
    });

    it("publicar trata motivo em branco como ausente", async () => {
      const fx = fixture();
      await fx.maps.publicar("event-1", "map-1", { revisaoBase: 2, motivo: "   " }, actor);
      expect(fx.state.audits[0].metadata.motivo).toBeNull();
    });

    it("publicar duas vezes: a segunda recebe MAP_NOT_IN_REVIEW", async () => {
      const fx = fixture();
      await fx.maps.publicar("event-1", "map-1", { revisaoBase: 2 }, actor);
      await expect(fx.maps.publicar("event-1", "map-1", { revisaoBase: 2 }, actor)).rejects.toMatchObject({ response: { code: "MAP_NOT_IN_REVIEW" } });
      expect(fx.state.seats).toHaveLength(2);
    });

    it("publicar torna a versão o mapa do evento, leva todas as sessões e arquiva as anteriores", async () => {
      const dbModule = jest.requireMock("@essencia/db") as any;
      const agora = new Date("2026-11-04T12:00:00Z");
      const state: any = {
        event: { id: "event-1", schoolId: "school-1", defaultMapId: "map-old" },
        sessions: [
          { id: "session-1", eventId: "event-1", mapId: "map-old", capacity: 1 },
          { id: "session-2", eventId: "event-1", mapId: "map-other", capacity: 1 },
        ],
        maps: [
          { id: "map-new", eventId: "event-1", status: "EM_REVISAO", version: 2 },
          { id: "map-old", eventId: "event-1", status: "CONFIRMADO", version: 1 },
          { id: "map-other", eventId: "event-1", status: "CONFIRMADO", version: 3 },
        ],
        imports: [{ id: "imp-1", mapId: "map-new", status: "EM_REVISAO", proposta: propostaValida() }],
        seats: [],
        versionSeats: [
          { id: "seat-1", mapId: "map-new", sellable: true },
          { id: "seat-2", mapId: "map-new", sellable: true },
          { id: "seat-3", mapId: "map-new", sellable: false },
        ],
        inventory: [],
        pedidos: [],
        itens: [],
        reservas: [],
        ingressos: [],
        checkins: [],
        operacoes: [],
        audits: [],
      };
      const rows = (table: unknown) => table === dbModule.eventos ? [state.event]
        : table === dbModule.eventoSessoes ? state.sessions
          : table === dbModule.eventoMapas ? state.maps
            : table === dbModule.eventoImportacoesMapa ? state.imports
              : table === dbModule.eventoMapaAssentos ? state.versionSeats
                : table === dbModule.eventoInventarioAssentos ? state.inventory
                  : table === dbModule.eventoPedidos ? state.pedidos
                    : table === dbModule.eventoItensPedido ? state.itens
                      : table === dbModule.eventoReservas ? state.reservas
                        : table === dbModule.eventoIngressos ? state.ingressos
                          : table === dbModule.eventoCheckins ? state.checkins
                            : table === dbModule.eventoOperacoesAdministrativas ? state.operacoes
                              : table === dbModule.eventoAuditorias ? state.audits : [];
      const db: any = {
        select: () => ({ from: (table: unknown) => ({ where: () => {
          const query: any = Promise.resolve(rows(table));
          query.for = () => query;
          query.orderBy = () => query;
          return query;
        } }) }),
        insert: (table: unknown) => ({ values: (values: any) => {
          if (table === dbModule.eventoMapaAssentos) state.seats.push({ id: `confirmed-${state.seats.length + 1}`, ...values });
          if (table === dbModule.eventoInventarioAssentos) state.inventory.push({ id: `inventory-${state.inventory.length + 1}`, ...values });
          if (table === dbModule.eventoAuditorias) state.audits.push(values);
          return { returning: async () => [{ id: `inserted-${state.audits.length}`, ...values }] };
        } }),
        update: (table: unknown) => ({ set: (values: any) => ({ where: () => {
          if (table === dbModule.eventos) Object.assign(state.event, values);
          if (table === dbModule.eventoMapas) {
            state.maps.filter((map: any) => map.id === "map-new" || map.id === "map-old" || map.id === "map-other").forEach((map: any) => {
              if (values.status === "ARQUIVADO" && map.id === "map-new") return;
              Object.assign(map, values);
            });
          }
          if (table === dbModule.eventoImportacoesMapa) Object.assign(state.imports[0], values);
          if (table === dbModule.eventoSessoes) state.sessions.forEach((session: any) => Object.assign(session, values));
          return { returning: async () => table === dbModule.eventoMapas ? [state.maps[0]] : table === dbModule.eventos ? [state.event] : [] };
        } }) }),
        delete: (table: unknown) => ({ where: async () => {
          if (table === dbModule.eventoMapaAssentos) state.seats = [];
          if (table === dbModule.eventoInventarioAssentos) state.inventory = [];
        } }),
        transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
      };
      const maps = new MapasService({ db } as any, undefined, {} as any);

      const resultado = await maps.publicar("event-1", "map-new", { revisaoBase: 2, motivo: "publicação" }, actor);

      expect(resultado).toEqual(expect.objectContaining({ sessionIds: ["session-1", "session-2"], capacidade: 2, arquivadas: expect.arrayContaining(["map-old", "map-other"]) }));
      expect(state.event.defaultMapId).toBe("map-new");
      expect(state.sessions.every((session: any) => session.mapId === "map-new" && session.capacity === 2)).toBe(true);
      expect(state.inventory).toHaveLength(6);
      expect(state.maps.filter((map: any) => map.status === "ARQUIVADO").map((map: any) => map.id)).toEqual(expect.arrayContaining(["map-old", "map-other"]));
      expect(state.audits).toEqual(expect.arrayContaining([expect.objectContaining({ metadata: expect.objectContaining({ action: "publicar", sessionIds: ["session-1", "session-2"], capacidade: 2 }) })]));
      expect(agora).toBeInstanceOf(Date);
    });

    it("publicar adquire os locks integrados na ordem determinística", async () => {
      const fx = fixture({ sessoes: [{ id: "session-1", eventId: "event-1" }], inventario: [{ id: "inventory-1", sessionId: "session-1" }] });
      await fx.maps.publicar("event-1", "map-1", { revisaoBase: 2 }, actor);
      const dbModule = jest.requireMock("@essencia/db") as any;
      expect(fx.state.locks.slice(0, 8)).toEqual([
        dbModule.eventos,
        dbModule.eventoSessoes,
        dbModule.eventoMapas,
        dbModule.eventoImportacoesMapa,
        dbModule.eventoInventarioAssentos,
        dbModule.eventoPedidos,
        dbModule.eventoItensPedido,
        dbModule.eventoReservas,
      ]);
    });

    it("desfaz a publicação se a defesa de venda surgir antes de levar as sessões", async () => {
      const fx = fixture({
        sessoes: [{ id: "session-1", eventId: "event-1" }],
        inventario: [{ id: "inventory-1", sessionId: "session-1" }],
        injetarVendaNaAtualizacaoEvento: true,
      });
      await expect(fx.maps.publicar("event-1", "map-1", { revisaoBase: 2 }, actor)).rejects.toMatchObject({ response: { code: "VENDA_CONFIRMADA" } });
      expect(fx.state.event.defaultMapId).toBeNull();
      expect(fx.state.map.status).toBe("EM_REVISAO");
      expect(fx.state.seats).toHaveLength(0);
      expect(fx.state.audits).toHaveLength(0);
    });

    it.each(["CONFIRMADO", "USADO", "NO_SHOW", "REEMBOLSADO"])("publicar recusa venda já confirmada (%s) sem gravar nada", async (status) => {
      const fx = fixture({ pedidos: [{ id: "pedido-1", eventId: "event-1", status, expiresAt: null }] });
      await expect(fx.maps.publicar("event-1", "map-1", { revisaoBase: 2 }, actor)).rejects.toMatchObject({ response: { code: "VENDA_CONFIRMADA" } });
      expect(fx.state.event.defaultMapId).toBeNull();
      expect(fx.state.map.status).toBe("EM_REVISAO");
      expect(fx.state.seats).toHaveLength(0);
      expect(fx.state.audits).toHaveLength(0);
    });

    it("publicar recusa compra em andamento sem gravar nada", async () => {
      const fx = fixture({ pedidos: [{ id: "pedido-1", eventId: "event-1", status: "AGUARDANDO_PAGAMENTO", expiresAt: new Date(Date.now() + 60_000) }] });
      await expect(fx.maps.publicar("event-1", "map-1", { revisaoBase: 2 }, actor)).rejects.toMatchObject({ response: { code: "COMPRA_EM_ANDAMENTO" } });
      expect(fx.state.event.defaultMapId).toBeNull();
      expect(fx.state.seats).toHaveLength(0);
    });

    it("publicar recusa operação administrativa ativa sem gravar nada", async () => {
      const fx = fixture({ operacoes: [{ id: "operacao-1", eventId: "event-1", status: "ATIVA" }] });
      await expect(fx.maps.publicar("event-1", "map-1", { revisaoBase: 2 }, actor)).rejects.toMatchObject({ response: { code: "OPERACAO_ATIVA" } });
      expect(fx.state.event.defaultMapId).toBeNull();
      expect(fx.state.seats).toHaveLength(0);
    });
  });

  describe("editar uma versão publicada", () => {
    const proposta = {
      versao: 1,
      revisao: 7,
      pagina: { numero: 1, largura: 8420, altura: 5950 },
      lugares: [{ id: "l1", fileira: "A", numero: "1", x: 100, y: 200, largura: 100, altura: 80, rotacao: 0, blocoId: "b1", cor: "#fff", categoriaManual: null, acessoExternoManual: null, vender: true, origem: "GERADOR" }],
      rotulos: [], elementos: [], legenda: [{ cor: "#fff", texto: "Comum", quantidade: 1, categoria: "COMUM", acessoExterno: false, confirmada: true }],
      pontos: [{ id: "p1", tipo: "SEM_FILEIRA", mensagem: "Conferido", lugarIds: ["l1"], conferido: true }],
    };

    function edicaoFixture(overrides: any = {}) {
      const dbModule = jest.requireMock("@essencia/db") as any;
      const state: any = {
        event: { id: "event-1", schoolId: "school-1", defaultMapId: "map-old" },
        sessions: [{ id: "session-2", eventId: "event-1" }, { id: "session-1", eventId: "event-1" }],
        inventory: [{ id: "inventory-2", sessionId: "session-2" }, { id: "inventory-1", sessionId: "session-1" }],
        maps: [
          { id: "map-old", eventId: "event-1", version: 3, status: "CONFIRMADO", originalFileKey: "eventos/event-1/mapas/originais/original.pdf", originalFileName: "original.pdf", originalMimeType: "application/pdf" },
          { id: "map-review", eventId: "event-1", version: 4, status: "EM_REVISAO", originalFileKey: "review.pdf", originalFileName: "review.pdf", originalMimeType: "application/pdf" },
        ],
        imports: [{ id: "imp-old", eventId: "event-1", mapId: "map-old", fileKey: "eventos/event-1/mapas/originais/original.pdf", detector: "pdf-vetorial", detectorVersion: "2", status: "CONFIRMADA", proposta, reviewedBy: "reviewer-1", reviewedAt: new Date("2026-11-03T00:00:00Z") }],
        pedidos: [], ingressos: [], checkins: [], operacoes: [],
        audits: [], uploads: [], deletes: [],
        falharNaInsercao: false,
        lockEvents: [],
        orderByCalls: [],
        nextMapNumber: 0,
        uploadNumber: 0,
        ...overrides,
      };
      const rows = (table: unknown) => table === dbModule.eventos ? [state.event]
        : table === dbModule.eventoSessoes ? state.sessions
          : table === dbModule.eventoMapas ? state.maps
            : table === dbModule.eventoImportacoesMapa ? state.imports
              : table === dbModule.eventoInventarioAssentos ? state.inventory
                : table === dbModule.eventoPedidos ? state.pedidos
                  : table === dbModule.eventoIngressos ? state.ingressos
                    : table === dbModule.eventoCheckins ? state.checkins
                      : table === dbModule.eventoOperacoesAdministrativas ? state.operacoes
                        : table === dbModule.eventoAuditorias ? state.audits : [];
      const valorColuna = (linha: any, coluna: unknown) => typeof coluna === "string" && coluna.includes(".") ? linha[coluna.slice(coluna.indexOf(".") + 1)] : undefined;
      const corresponde = (linha: any, condicao: any): boolean => !condicao
        || condicao.tipo === "eq" && valorColuna(linha, condicao.coluna) === condicao.valor
        || condicao.tipo === "inArray" && condicao.valores.includes(valorColuna(linha, condicao.coluna))
        || condicao.tipo === "and" && condicao.condicoes.every((item: any) => corresponde(linha, item));
      const db: any = {
        select: () => ({ from: (table: unknown) => {
          let selecionadas = rows(table).slice();
          const q: any = { then: (resolve: any, reject: any) => Promise.resolve(selecionadas).then(resolve, reject) };
          q.where = (condicao: any) => { selecionadas = selecionadas.filter((linha: any) => corresponde(linha, condicao)); return q; };
          q.orderBy = (...ordens: any[]) => { state.orderByCalls.push({ table, ordens }); selecionadas.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))); return q; };
          q.for = (modo: string) => { state.lockEvents.push({ table, modo, ids: selecionadas.map((linha: any) => linha.id) }); return q; };
          return q;
        } }),
        insert: (table: unknown) => ({ values: (values: any) => {
          if (state.falharNaInsercao && table === dbModule.eventoMapas) throw new Error("falha no banco");
          const id = table === dbModule.eventoMapas ? state.nextMapNumber++ === 0 ? "map-new" : `map-new-${state.nextMapNumber}` : table === dbModule.eventoImportacoesMapa ? `imp-new-${state.imports.length}` : "audit-1";
          if (table === dbModule.eventoMapas) state.maps.push({ id, ...values });
          if (table === dbModule.eventoImportacoesMapa) state.imports.push({ id, ...values });
          if (table === dbModule.eventoAuditorias) state.audits.push(values);
          return { returning: async () => [{ id, ...values }] };
        } }),
        update: (table: unknown) => ({ set: (values: any) => ({ where: (condicao: any) => {
          const alvo = rows(table).filter((linha: any) => corresponde(linha, condicao));
          alvo.forEach((linha: any) => Object.assign(linha, values));
          return { returning: async () => alvo.map((linha: any) => ({ ...linha })) };
        } }) }),
        transaction: async (fn: any) => fn(db),
      };
      const storage: any = {
        getObject: jest.fn().mockResolvedValue({ Body: { transformToByteArray: async () => new Uint8Array([37, 80, 68, 70, 45]) } }),
        uploadMapBuffer: jest.fn().mockImplementation(async (buffer: Buffer, filename: string, mime: string, prefix: string) => { state.uploadNumber += 1; state.uploads.push({ buffer, filename, mime, prefix }); return { key: `${prefix}/${state.uploadNumber === 1 ? "copied.pdf" : `copied-${state.uploadNumber}.pdf`}` }; }),
        deleteFileStrict: jest.fn().mockResolvedValue(undefined),
      };
      const maps = new MapasService({ db } as any, storage, {} as any);
      return { maps, state, storage };
    }

    it("editarVersao cria versão em conferência mantendo a proposta e conferências", async () => {
      const fx = edicaoFixture();
      const result = await fx.maps.editarVersao("event-1", "map-old", actor);
      expect(result).toEqual({ mapId: "map-new" });
      expect(fx.state.maps).toEqual(expect.arrayContaining([expect.objectContaining({ id: "map-new", version: 5, status: "EM_REVISAO", originalFileKey: "eventos/event-1/mapas/originais/copied.pdf" })]));
      expect(fx.state.maps.find((map: any) => map.id === "map-review").status).toBe("ARQUIVADO");
      expect(fx.state.imports).toEqual(expect.arrayContaining([expect.objectContaining({ mapId: "map-new", detector: "edicao", detectorVersion: "2", proposta: expect.objectContaining({ revisao: 0, pontos: proposta.pontos }) })]));
      expect(fx.state.audits).toEqual(expect.arrayContaining([expect.objectContaining({ metadata: { action: "editar_versao", origemMapId: "map-old" } })]));
    });

    it("editarVersao aceita uma versão ARQUIVADO que ainda tem proposta", async () => {
      const fx = edicaoFixture({
        maps: [{ id: "map-old", eventId: "event-1", version: 3, status: "ARQUIVADO", originalFileKey: "eventos/event-1/mapas/originais/original.pdf", originalFileName: "original.pdf", originalMimeType: "application/pdf" }],
      });
      await expect(fx.maps.editarVersao("event-1", "map-old", actor)).resolves.toEqual({ mapId: "map-new" });
      expect(fx.state.maps).toEqual(expect.arrayContaining([expect.objectContaining({ id: "map-new", status: "EM_REVISAO" })]));
    });

    it("duas edições consecutivas deixam somente a última versão em conferência", async () => {
      const fx = edicaoFixture();
      await fx.maps.editarVersao("event-1", "map-old", actor);
      await fx.maps.editarVersao("event-1", "map-old", actor);
      expect(fx.state.maps.filter((map: any) => map.status === "EM_REVISAO")).toEqual([expect.objectContaining({ id: "map-new-2" })]);
      expect(fx.state.maps.find((map: any) => map.id === "map-new").status).toBe("ARQUIVADO");
      expect(fx.state.maps.find((map: any) => map.id === "map-old").status).toBe("CONFIRMADO");
    });

    it("editarVersao copia o PDF original para uma chave nova", async () => {
      const fx = edicaoFixture();
      await fx.maps.editarVersao("event-1", "map-old", actor);
      expect(fx.storage.getObject).toHaveBeenCalledWith("eventos/event-1/mapas/originais/original.pdf");
      expect(fx.storage.uploadMapBuffer).toHaveBeenCalledWith(Buffer.from([37, 80, 68, 70, 45]), "original.pdf", "application/pdf", "eventos/event-1/mapas/originais");
    });

    it.each([
      ["map-review", "EM_REVISAO"],
      ["map-old", "CONFIRMADO"],
    ])("editarVersao recusa quando não há proposta ou a versão está inválida (%s)", async (mapId, status) => {
      const fx = edicaoFixture({ maps: [{ id: mapId, eventId: "event-1", version: 3, status, originalFileKey: "arquivo.pdf", originalFileName: "arquivo.pdf", originalMimeType: "application/pdf" }], imports: status === "EM_REVISAO" ? [] : [{ id: "imp-old", eventId: "event-1", mapId, proposta: null }] });
      await expect(fx.maps.editarVersao("event-1", mapId, actor)).rejects.toMatchObject({ response: { code: "EDICAO_INDISPONIVEL" } });
    });

    it("editarVersao recusa com venda confirmada sem copiar o arquivo", async () => {
      const fx = edicaoFixture({ pedidos: [{ id: "pedido-1", eventId: "event-1", status: "CONFIRMADO", expiresAt: null }] });
      await expect(fx.maps.editarVersao("event-1", "map-old", actor)).rejects.toMatchObject({ response: { code: "VENDA_CONFIRMADA" } });
      expect(fx.storage.getObject).not.toHaveBeenCalled();
      expect(fx.storage.uploadMapBuffer).not.toHaveBeenCalled();
    });

    it("editarVersao recusa COMPRA_EM_ANDAMENTO antes de acessar o PDF", async () => {
      const fx = edicaoFixture({ pedidos: [{ id: "pedido-1", eventId: "event-1", status: "AGUARDANDO_PAGAMENTO", expiresAt: new Date(Date.now() + 60_000) }] });
      await expect(fx.maps.editarVersao("event-1", "map-old", actor)).rejects.toMatchObject({ response: { code: "COMPRA_EM_ANDAMENTO" } });
      expect(fx.storage.getObject).not.toHaveBeenCalled();
      expect(fx.storage.uploadMapBuffer).not.toHaveBeenCalled();
    });

    it("editarVersao recusa OPERACAO_ATIVA antes de acessar o PDF", async () => {
      const fx = edicaoFixture({ operacoes: [{ id: "operacao-1", eventId: "event-1", status: "ATIVA" }] });
      await expect(fx.maps.editarVersao("event-1", "map-old", actor)).rejects.toMatchObject({ response: { code: "OPERACAO_ATIVA" } });
      expect(fx.storage.getObject).not.toHaveBeenCalled();
      expect(fx.storage.uploadMapBuffer).not.toHaveBeenCalled();
    });

    it("editarVersao adquire locks na ordem global e ordena cada conjunto por id", async () => {
      const fx = edicaoFixture({ pedidos: [{ id: "pedido-2", eventId: "event-1", status: "CANCELADO", expiresAt: null }, { id: "pedido-1", eventId: "event-1", status: "CANCELADO", expiresAt: null }] });
      const dbModule = jest.requireMock("@essencia/db") as any;
      await fx.maps.editarVersao("event-1", "map-old", actor);
      expect(fx.state.lockEvents.map((evento: any) => evento.table)).toEqual([
        dbModule.eventos,
        dbModule.eventoSessoes,
        dbModule.eventoMapas,
        dbModule.eventoImportacoesMapa,
        dbModule.eventoInventarioAssentos,
        dbModule.eventoPedidos,
      ]);
      expect(fx.state.lockEvents.every((evento: any) => evento.modo === "update")).toBe(true);
      expect(fx.state.orderByCalls.map((chamada: any) => [chamada.table, chamada.ordens[0].coluna])).toEqual([
        [dbModule.eventoSessoes, dbModule.eventoSessoes.id],
        [dbModule.eventoMapas, dbModule.eventoMapas.id],
        [dbModule.eventoImportacoesMapa, dbModule.eventoImportacoesMapa.id],
        [dbModule.eventoInventarioAssentos, dbModule.eventoInventarioAssentos.id],
        [dbModule.eventoPedidos, dbModule.eventoPedidos.id],
      ]);
      expect(fx.state.lockEvents.find((evento: any) => evento.table === dbModule.eventoPedidos).ids).toEqual(["pedido-1", "pedido-2"]);
    });

    it("falha no banco apaga a cópia do PDF", async () => {
      const fx = edicaoFixture({ falharNaInsercao: true });
      await expect(fx.maps.editarVersao("event-1", "map-old", actor)).rejects.toThrow();
      expect(fx.storage.deleteFileStrict).toHaveBeenCalledWith("eventos/event-1/mapas/originais/copied.pdf");
    });
  });

  describe("excluir uma versão", () => {
    function exclusaoFixture(overrides: any = {}) {
      const dbModule = jest.requireMock("@essencia/db") as any;
      const state: any = {
        event: { id: "event-1", schoolId: "school-1", defaultMapId: "map-current" },
        sessions: [{ id: "session-1", eventId: "event-1", mapId: "map-delete", capacity: 1 }],
        maps: [
          { id: "map-current", eventId: "event-1", version: 1, status: "CONFIRMADO", originalFileKey: "current.pdf", previewFileKey: "current.svg" },
          { id: "map-delete", eventId: "event-1", version: 2, status: "CONFIRMADO", originalFileKey: "delete.pdf", previewFileKey: "delete.svg" },
        ],
        seats: [{ id: "seat-current", mapId: "map-current", sellable: true }],
        inventory: [{ id: "inventory-delete", sessionId: "session-1", seatId: "seat-old", status: "DISPONIVEL" }],
        imports: [{ id: "import-delete", eventId: "event-1", mapId: "map-delete" }],
        pedidos: [], itens: [], reservas: [], ingressos: [], checkins: [], operacoes: [], audits: [],
        ...overrides,
      };
      const rows = (table: unknown) => table === dbModule.eventos ? [state.event]
        : table === dbModule.eventoSessoes ? state.sessions
          : table === dbModule.eventoMapas ? state.maps
            : table === dbModule.eventoMapaAssentos ? state.seats
              : table === dbModule.eventoInventarioAssentos ? state.inventory
                : table === dbModule.eventoImportacoesMapa ? state.imports
                  : table === dbModule.eventoPedidos ? state.pedidos
                    : table === dbModule.eventoItensPedido ? state.itens
                      : table === dbModule.eventoReservas ? state.reservas
                        : table === dbModule.eventoIngressos ? state.ingressos
                          : table === dbModule.eventoCheckins ? state.checkins
                            : table === dbModule.eventoOperacoesAdministrativas ? state.operacoes
                              : table === dbModule.eventoAuditorias ? state.audits : [];
      const valorColuna = (linha: any, coluna: unknown) => typeof coluna === "string" && coluna.includes(".") ? linha[coluna.slice(coluna.indexOf(".") + 1)] : undefined;
      const corresponde = (linha: any, condicao: any): boolean => !condicao
        || condicao.tipo === "eq" && valorColuna(linha, condicao.coluna) === condicao.valor
        || condicao.tipo === "inArray" && condicao.valores.includes(valorColuna(linha, condicao.coluna))
        || condicao.tipo === "and" && condicao.condicoes.every((item: any) => corresponde(linha, item));
      const db: any = {
        select: () => ({ from: (table: unknown) => {
          let selecionadas = rows(table).slice();
          const q: any = { then: (resolve: any, reject: any) => Promise.resolve(selecionadas).then(resolve, reject) };
          q.where = (condicao: any) => { selecionadas = selecionadas.filter((linha: any) => corresponde(linha, condicao)); return q; };
          q.orderBy = () => { selecionadas.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))); return q; };
          q.for = () => q;
          return q;
        } }),
        update: (table: unknown) => ({ set: (values: any) => ({ where: (condicao: any) => {
          const alvo = rows(table).filter((linha: any) => corresponde(linha, condicao));
          alvo.forEach((linha: any) => Object.assign(linha, values));
          return { returning: async () => alvo.map((linha: any) => ({ ...linha })) };
        } }) }),
        delete: (table: unknown) => ({ where: async (condicao: any) => {
          const lista = rows(table);
          const removidos = lista.filter((linha: any) => corresponde(linha, condicao));
          for (const linha of removidos) lista.splice(lista.indexOf(linha), 1);
        } }),
        insert: (table: unknown) => ({ values: (values: any) => {
          if (table === dbModule.eventoInventarioAssentos) state.inventory.push({ id: `inventory-new-${state.inventory.length}`, ...values });
          if (table === dbModule.eventoAuditorias) state.audits.push(values);
          return { returning: async () => [{ id: "inserted", ...values }] };
        } }),
        transaction: async (fn: any) => fn(db),
      };
      const storage: any = {
        deleteFile: jest.fn().mockResolvedValue(undefined),
      };
      const maps = new MapasService({ db } as any, storage, {} as any);
      return { maps, state, storage };
    }

    it("exclui versão sem sessão, apaga importação e arquivos", async () => {
      const fx = exclusaoFixture({ sessions: [], inventory: [] });
      await expect(fx.maps.excluirVersao("event-1", "map-delete", actor)).resolves.toEqual({ excluida: true, sessionIds: [] });
      expect(fx.state.maps).toEqual([expect.objectContaining({ id: "map-current" })]);
      expect(fx.state.imports).toHaveLength(0);
      expect(fx.storage.deleteFile).toHaveBeenCalledWith("delete.pdf");
      expect(fx.storage.deleteFile).toHaveBeenCalledWith("delete.svg");
    });

    it("leva a sessão usada para a versão atual antes de excluir", async () => {
      const fx = exclusaoFixture();
      await expect(fx.maps.excluirVersao("event-1", "map-delete", actor)).resolves.toEqual({ excluida: true, sessionIds: ["session-1"] });
      expect(fx.state.sessions[0]).toEqual(expect.objectContaining({ mapId: "map-current", capacity: 1 }));
      expect(fx.state.inventory).toEqual([expect.objectContaining({ sessionId: "session-1", seatId: "seat-current", status: "DISPONIVEL" })]);
    });

    it("recusa a versão atual com MAPA_ATUAL", async () => {
      const fx = exclusaoFixture();
      await expect(fx.maps.excluirVersao("event-1", "map-current", actor)).rejects.toMatchObject({ response: { code: "MAPA_ATUAL", message: "A versão atual não pode ser excluída." } });
      expect(fx.state.maps).toHaveLength(2);
    });

    it("recusa compra em andamento sem apagar nada", async () => {
      const fx = exclusaoFixture({ sessions: [], inventory: [], pedidos: [{ id: "pedido-1", eventId: "event-1", status: "AGUARDANDO_PAGAMENTO", expiresAt: new Date(Date.now() + 60_000) }] });
      await expect(fx.maps.excluirVersao("event-1", "map-delete", actor)).rejects.toMatchObject({ response: { code: "COMPRA_EM_ANDAMENTO" } });
      expect(fx.state.maps).toHaveLength(2);
      expect(fx.state.imports).toHaveLength(1);
      expect(fx.storage.deleteFile).not.toHaveBeenCalled();
    });

    it("considera arquivo ausente no storage como exclusão concluída", async () => {
      const fx = exclusaoFixture({ sessions: [], inventory: [] });
      fx.storage.deleteFile.mockRejectedValue(Object.assign(new Error("ausente"), { name: "NoSuchKey" }));
      await expect(fx.maps.excluirVersao("event-1", "map-delete", actor)).resolves.toEqual({ excluida: true, sessionIds: [] });
      expect(fx.state.maps).toHaveLength(1);
    });

    it("exclui uma conferência aberta", async () => {
      const fx = exclusaoFixture({ sessions: [], inventory: [], maps: [
        { id: "map-current", eventId: "event-1", version: 1, status: "CONFIRMADO", originalFileKey: "current.pdf", previewFileKey: null },
        { id: "map-delete", eventId: "event-1", version: 2, status: "EM_REVISAO", originalFileKey: "review.pdf", previewFileKey: null },
      ] });
      await expect(fx.maps.excluirVersao("event-1", "map-delete", actor)).resolves.toEqual({ excluida: true, sessionIds: [] });
      expect(fx.state.maps).toHaveLength(1);
    });
  });

  describe("substituirMapaPadrao", () => {
    const novoMapa = { id: "map-novo", eventId: "event-1", status: "CONFIRMADO", previewFileKey: null };
    const assento = { id: "seat-1", mapId: "map-novo", sellable: true };

    function fakeTransacional(options: { falharNoSegundoAudit?: boolean; storage?: any } = {}) {
      const dbModule = jest.requireMock("@essencia/db") as typeof import("@essencia/db");
      const state: any = {
        event: { id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" },
        maps: [
          { id: "map-novo", eventId: "event-1", status: "CONFIRMADO", previewFileKey: null },
          { id: "map-antigo", eventId: "event-1", status: "CONFIRMADO", previewFileKey: "preview/antigo.svg" },
        ],
        sessions: [
          { id: "sessao-herdada", eventId: "event-1", mapId: null },
          { id: "sessao-explicita-novo", eventId: "event-1", mapId: "map-novo" },
          { id: "sessao-explicita-antigo", eventId: "event-1", mapId: "map-antigo" },
        ],
        seats: [
          { id: "seat-novo-1", mapId: "map-novo", sellable: true },
          { id: "seat-novo-2", mapId: "map-novo", sellable: false },
          { id: "seat-antigo-1", mapId: "map-antigo", sellable: true },
          { id: "seat-antigo-2", mapId: "map-antigo", sellable: true },
          { id: "seat-antigo-3", mapId: "map-antigo", sellable: true },
          { id: "seat-antigo-4", mapId: "map-antigo", sellable: true },
          { id: "seat-antigo-5", mapId: "map-antigo", sellable: true },
          { id: "seat-antigo-6", mapId: "map-antigo", sellable: true },
        ],
        inventory: [
          { id: "inv-herdada-disponivel", sessionId: "sessao-herdada", seatId: "seat-antigo-1", status: "DISPONIVEL" },
          { id: "inv-herdada-liberado", sessionId: "sessao-herdada", seatId: "seat-antigo-2", status: "LIBERADO" },
          { id: "inv-herdada-reservado", sessionId: "sessao-herdada", seatId: "seat-antigo-3", status: "RESERVADO", reservedByOrderId: "pedido-1" },
          { id: "inv-herdada-vendido", sessionId: "sessao-herdada", seatId: "seat-antigo-4", status: "VENDIDO", soldAt: new Date("2026-10-31T12:00:00Z") },
          { id: "inv-explicita-novo", sessionId: "sessao-explicita-novo", seatId: "seat-novo-1", status: "RESERVADO", reservedByOrderId: "pedido-2" },
          { id: "inv-explicita-antigo", sessionId: "sessao-explicita-antigo", seatId: "seat-antigo-5", status: "VENDIDO", soldAt: new Date("2026-10-30T12:00:00Z") },
          { id: "inv-historico", sessionId: "sessao-herdada", seatId: "seat-antigo-6", status: "BLOQUEADO", blockedReason: "historico" },
        ],
        audits: [],
      };
      let mapSelects = 0;
      let inventorySelects = 0;
      let auditCalls = 0;
      const updates: any[] = [];
      let committed = false;
      const clone = () => JSON.parse(JSON.stringify(state));
      const rowsFor = (table: unknown) => {
        if (table === dbModule.eventos) return [state.event];
        if (table === dbModule.eventoMapas) return [state.maps[mapSelects++ === 0 ? 0 : 1]];
        if (table === dbModule.eventoMapaAssentos) return state.seats;
        if (table === dbModule.eventoSessoes) return state.sessions;
        if (table === dbModule.eventoInventarioAssentos) {
          inventorySelects += 1;
          return state.inventory.filter((item: any) => item.sessionId === "sessao-herdada");
        }
        return [];
      };
      const db: any = {
        select: () => ({
          from: (table: unknown) => ({
            where: () => {
              const query: any = {
                for: () => Promise.resolve(rowsFor(table)),
                then: (resolve: (value: any[]) => unknown) => Promise.resolve(rowsFor(table)).then(resolve),
              };
              return query;
            },
          }),
        }),
        update: (table: unknown) => ({
          set: (values: any) => {
            let applied = false;
            const apply = () => {
              if (applied) return;
              applied = true;
                updates.push({ table, values });
                if (table === dbModule.eventos) Object.assign(state.event, values);
                if (table === dbModule.eventoMapas) Object.assign(state.maps.find((map: any) => map.id === "map-antigo"), values);
                if (table === dbModule.eventoInventarioAssentos || values.status === "BLOQUEADO") {
                  for (const item of state.inventory.filter((item: any) => item.sessionId === "sessao-herdada" && ["DISPONIVEL", "LIBERADO"].includes(item.status))) Object.assign(item, values);
                }
            };
            return {
              where: () => {
                apply();
                const result: any = {
                  returning: async () => [{ id: table === dbModule.eventos ? "event-1" : "map-antigo", ...values }],
                  then: (resolve: (value: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
                };
                return result;
              },
            };
          },
        }),
        insert: (table: unknown) => ({
          values: async (values: any) => {
            if (table === dbModule.eventoInventarioAssentos) state.inventory.push({ id: `inv-novo-${state.inventory.length}`, ...values });
            if (table === dbModule.eventoAuditorias) {
              auditCalls += 1;
              if (options.falharNoSegundoAudit && auditCalls === 2) throw new Error("auditoria falhou");
              state.audits.push(values);
            }
          },
        }),
        transaction: async (fn: any) => {
          const snapshot = clone();
          committed = false;
          try {
            const result = await fn(db);
            committed = true;
            return result;
          } catch (error) {
            Object.assign(state, snapshot);
            throw error;
          }
        },
      };
      return { db, state, storage: options.storage, updates, get committed() { return committed; }, get inventorySelects() { return inventorySelects; } };
    }

    it("aplica a substituição preservando reservas, vendas, históricos e sessão explícita no mapa novo", async () => {
      const storage = { deleteFile: jest.fn() };
      const fake = fakeTransacional({ storage });
      const result = await new MapasService({ db: fake.db } as any, storage as any, {} as any).substituirMapaPadrao("event-1", "map-novo", actor);
      expect(fake.state.event.defaultMapId).toBe("map-novo");
      expect(fake.state.maps.find((map: any) => map.id === "map-antigo").status).toBe("CONFIRMADO");
      expect(fake.state.inventory).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "inv-herdada-disponivel", status: "BLOQUEADO", blockedReason: "MAPA_PADRAO_ALTERADO" }),
        expect.objectContaining({ id: "inv-herdada-liberado", status: "BLOQUEADO", blockedReason: "MAPA_PADRAO_ALTERADO" }),
        expect.objectContaining({ id: "inv-herdada-reservado", status: "RESERVADO" }),
        expect.objectContaining({ id: "inv-herdada-vendido", status: "VENDIDO" }),
        expect.objectContaining({ id: "inv-historico", status: "BLOQUEADO", blockedReason: "historico" }),
        expect.objectContaining({ id: "inv-explicita-novo", status: "RESERVADO" }),
      ]));
      expect(fake.state.inventory.filter((item: any) => item.sessionId === "sessao-explicita-novo")).toHaveLength(1);
      expect(result.inheritedSessionIds).toEqual(["sessao-herdada"]);
      expect(result.previousMapArchive).toEqual({ archived: false, code: "MAP_IN_USE", sessionIds: ["sessao-explicita-antigo", "sessao-herdada"] });
      expect(storage.deleteFile).not.toHaveBeenCalled();
    });

    it("preserva o mapa anterior quando somente o inventário herdado ainda aponta para seus assentos", async () => {
      const storage = { deleteFile: jest.fn() };
      const fake = fakeTransacional({ storage });
      fake.state.sessions = fake.state.sessions.filter((session: any) => session.id !== "sessao-explicita-antigo");
      const result = await new MapasService({ db: fake.db } as any, storage as any, {} as any).substituirMapaPadrao("event-1", "map-novo", actor);
      expect(result.previousMapArchive).toEqual({ archived: false, code: "MAP_IN_USE", sessionIds: ["sessao-herdada"] });
      expect(fake.state.maps.find((map: any) => map.id === "map-antigo").status).toBe("CONFIRMADO");
      expect(storage.deleteFile).not.toHaveBeenCalled();
    });

    it("desfaz todas as mutações do fake transacional quando a auditoria falha após o inventário", async () => {
      const fake = fakeTransacional({ falharNoSegundoAudit: true });
      const before = JSON.parse(JSON.stringify(fake.state));
      await expect(new MapasService({ db: fake.db } as any, undefined, {} as any).substituirMapaPadrao("event-1", "map-novo", actor)).rejects.toThrow("auditoria falhou");
      expect(fake.state).toEqual(before);
      expect(fake.inventorySelects).toBe(2);
    });

    it("remove o preview somente depois do commit e não desfaz a troca se o storage falhar", async () => {
      const storage = { deleteFile: jest.fn() };
      const fake = fakeTransacional({ storage });
      storage.deleteFile.mockImplementation(async () => {
        expect(fake.committed).toBe(true);
        throw new Error("storage indisponível");
      });
      fake.state.sessions = fake.state.sessions.filter((session: any) => session.id !== "sessao-explicita-antigo");
      fake.state.inventory = fake.state.inventory.filter((item: any) => item.sessionId !== "sessao-herdada");
      const maps = new MapasService({ db: fake.db } as any, storage as any, {} as any);
      (maps as any).sincronizarInventarioMapa = jest.fn().mockResolvedValue({ inventorySessionIds: ["sessao-herdada"], inventoryCreatedCount: 1 });
      const result = await maps.substituirMapaPadrao("event-1", "map-novo", actor);
      expect(result.previousMapArchive).toEqual({ archived: true, code: "ARCHIVED" });
      expect(fake.state.event.defaultMapId).toBe("map-novo");
      expect(storage.deleteFile).toHaveBeenCalledWith("preview/antigo.svg");
      expect(fake.state.audits).toEqual(expect.arrayContaining([expect.objectContaining({ metadata: expect.objectContaining({ action: "substituir_mapa_padrao" }) })]));
    });

    it("troca mapa confirmado, bloqueia herdadas, sincroniza inventário e arquiva o anterior", async () => {
      const updates: any[] = [];
      let selects = 0;
      const audits: any[] = [];
      const db: any = {
        select: () => ({ from: () => ({ where: async () => {
          selects += 1;
          return selects === 1 ? [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" }]
            : selects === 2 ? [{ id: "sessao-herdada", eventId: "event-1", mapId: null }]
              : selects === 3 ? [novoMapa]
                : selects === 4 ? [assento]
                  : selects === 5 ? [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-novo" }]
                    : selects === 6 ? [{ id: "sessao-herdada", eventId: "event-1", mapId: null }]
                      : selects === 7 ? [assento]
                        : selects === 8 ? []
                          : selects === 9 ? [{ id: "map-antigo", eventId: "event-1", status: "CONFIRMADO", previewFileKey: null }]
                            : [];
        } }) }),
        update: (table: unknown) => ({ set: (values: any) => { updates.push({ table, values }); return { where: () => ({ returning: async () => [{ id: table === (jest.requireMock("@essencia/db") as any).eventos ? "event-1" : "map-antigo", status: values.status ?? "CONFIRMADO" }] }) }; } }),
        insert: () => ({ values: (values: any) => { audits.push(values); return { returning: async () => [{ id: "audit-1" }] }; } }),
        transaction: async (fn: any) => fn(db),
      };
      const maps = new MapasService({ db } as any, undefined, {} as any);
      const result = await maps.substituirMapaPadrao("event-1", "map-novo", actor);
      expect(result.previousMapId).toBe("map-antigo");
      expect(result.inheritedSessionIds).toEqual(["sessao-herdada"]);
      expect(result.previousMapArchive).toEqual({ archived: true, code: "ARCHIVED" });
      expect(updates.some((item) => item.values.blockedReason === "MAPA_PADRAO_ALTERADO")).toBe(true);
    });

    it.each([
      ["EM_REVISAO", "MAP_NOT_CONFIRMED"],
      ["ARQUIVADO", "MAP_NOT_CONFIRMED"],
    ])("rejeita mapa com status %s", async (status, code) => {
      let call = 0;
      const db: any = { select: () => ({ from: () => ({ where: async () => ++call === 1 ? [{ id: "event-1", schoolId: "school-1", defaultMapId: null }] : [{ id: "map-novo", eventId: "event-1", status }] }) }) };
      const maps = new MapasService({ db } as any, undefined, {} as any);
      await expect(maps.substituirMapaPadrao("event-1", "map-novo", actor)).rejects.toMatchObject({ response: { code } });
    });

    it("rejeita mapa inexistente ou de outro evento", async () => {
      let call = 0;
      const db: any = { select: () => ({ from: () => ({ where: async () => ++call === 1 ? [{ id: "event-1", schoolId: "school-1" }] : [] }) }) };
      const maps = new MapasService({ db } as any, undefined, {} as any);
      await expect(maps.substituirMapaPadrao("event-1", "inexistente", actor)).rejects.toMatchObject({ response: { code: "MAP_NOT_FOUND" } });
      call = 0;
      const outroDb: any = { select: () => ({ from: () => ({ where: async () => ++call === 1 ? [{ id: "event-1", schoolId: "school-1" }] : [{ id: "map-novo", eventId: "event-2", status: "CONFIRMADO" }] }) }) };
      await expect(new MapasService({ db: outroDb } as any, undefined, {} as any).substituirMapaPadrao("event-1", "map-novo", actor)).rejects.toMatchObject({ response: { code: "MAP_EVENT_MISMATCH" } });
    });

    it("é idempotente quando o mapa já é o padrão", async () => {
      let call = 0;
      const update = jest.fn();
      const db: any = { select: () => ({ from: () => ({ where: async () => ++call === 1 ? [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-novo" }] : [{ ...novoMapa }] }) }), update };
      const result = await new MapasService({ db } as any, undefined, {} as any).substituirMapaPadrao("event-1", "map-novo", actor);
      expect(result.previousMapArchive).toEqual({ archived: false, code: "NO_PREVIOUS_MAP" });
      expect(update).not.toHaveBeenCalled();
    });

    it("recupera o resultado persistido no retry depois de arquivar o mapa anterior", async () => {
      const dbModule = jest.requireMock("@essencia/db") as typeof import("@essencia/db");
      const state: any = {
        event: { id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" },
        maps: [
          { id: "map-novo", eventId: "event-1", status: "CONFIRMADO", version: 2, previewFileKey: null },
          { id: "map-antigo", eventId: "event-1", status: "CONFIRMADO", version: 1, previewFileKey: "preview/antigo.svg" },
        ],
        sessions: [{ id: "sessao-herdada", eventId: "event-1", mapId: null }],
        seats: [{ id: "seat-novo", mapId: "map-novo", sellable: true }],
        audits: [] as any[],
      };
      let mapReads = 0;
      const rows = (table: unknown) => {
        if (table === dbModule.eventos) return [state.event];
        if (table === dbModule.eventoSessoes) return state.sessions;
        if (table === dbModule.eventoMapas) return [state.maps[mapReads++ % 3 === 1 ? 1 : 0]];
        if (table === dbModule.eventoMapaAssentos) return state.seats;
        if (table === dbModule.eventoAuditorias) return state.audits;
        return [];
      };
      const db: any = {
        select: () => ({ from: (table: unknown) => ({ where: () => {
          const query: any = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows(table)).then(resolve) };
          query.for = () => Promise.resolve(rows(table));
          return query;
        } }) }),
        update: (table: unknown) => ({ set: (values: any) => ({ where: () => ({ returning: async () => {
          if (table === dbModule.eventos) Object.assign(state.event, values);
          if (table === dbModule.eventoMapas) Object.assign(state.maps[1], values);
          return [table === dbModule.eventos ? state.event : state.maps[1]];
        } }) }) }),
        insert: (table: unknown) => ({ values: (values: any) => {
          if (table === dbModule.eventoAuditorias) state.audits.push(values);
          return { returning: async () => [{ id: "audit-1" }] };
        } }),
        transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
      };
      const maps = new MapasService({ db } as any, undefined, {} as any);
      (maps as any).sincronizarInventarioMapa = jest.fn().mockResolvedValue({ inventorySessionIds: ["sessao-herdada"], inventoryCreatedCount: 2 });

      const first = await maps.substituirMapaPadrao("event-1", "map-novo", actor);
      state.event.defaultMapId = "map-novo";
      const retry = await maps.substituirMapaPadrao("event-1", "map-novo", actor);

      expect(first.previousMapArchive).toEqual({ archived: true, code: "ARCHIVED" });
      expect(retry).toMatchObject({
        previousMapId: "map-antigo",
        inheritedSessionIds: ["sessao-herdada"],
        inventorySessionIds: ["sessao-herdada"],
        inventoryCreatedCount: 2,
        previousMapArchive: { archived: true, code: "ARCHIVED" },
      });
      expect((maps as any).sincronizarInventarioMapa).toHaveBeenCalledTimes(1);
    });

    it("preserva mapa anterior quando uma sessão tem referência explícita", async () => {
      let selects = 0;
      const updates: any[] = [];
      const db: any = {
        select: () => ({ from: () => ({ where: async () => {
          selects += 1;
          return selects === 1 ? [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" }] : selects === 2 ? [{ id: "sessao-explicita", mapId: "map-antigo" }] : selects === 3 ? [novoMapa] : selects === 4 ? [assento] : selects === 5 ? [{ id: "event-1", defaultMapId: "map-novo" }] : selects === 6 ? [{ id: "sessao-explicita", mapId: "map-antigo" }] : selects === 7 ? [] : selects === 8 ? [assento] : [];
        } }) }),
        update: () => ({ set: (values: any) => { updates.push(values); return { where: () => ({ returning: async () => [{ id: "event-1" }] }) }; } }),
        insert: () => ({ values: () => ({ returning: async () => [{ id: "audit-1" }] }) }),
        transaction: async (fn: any) => fn(db),
      };
      const result = await new MapasService({ db } as any, undefined, {} as any).substituirMapaPadrao("event-1", "map-novo", actor);
      expect(result.previousMapArchive).toEqual({ archived: false, code: "MAP_IN_USE", sessionIds: ["sessao-explicita"] });
      expect(updates.some((values) => values.status === "ARQUIVADO")).toBe(false);
    });

    it("propaga falha da sincronização e não conclui a troca", async () => {
      const update = jest.fn(() => ({ set: () => ({ where: () => ({ returning: async () => [{ id: "event-1" }] }) }) }));
      let call = 0;
      const db: any = {
        select: () => ({ from: () => ({ where: async () => ++call === 1 ? [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" }] : ++call === 3 ? [{ id: "seat-1", mapId: "map-novo" }] : call === 2 ? [novoMapa] : [{ id: "sessao", mapId: null }] }) }),
        update,
        transaction: async (fn: any) => fn({ ...db, insert: () => ({ values: async () => { throw new Error("inventário falhou"); } }) }),
      };
      await expect(new MapasService({ db } as any, undefined, {} as any).substituirMapaPadrao("event-1", "map-novo", actor)).rejects.toThrow();
      expect(update).toHaveBeenCalledTimes(0);
    });

    it("não sincroniza sessão explícita que já aponta para o mapa novo", async () => {
      let selects = 0;
      const sincronizar = jest.fn().mockResolvedValue({ inventorySessionIds: ["sessao-herdada"], inventoryCreatedCount: 1 });
      const db: any = {
        select: () => ({ from: () => ({ where: async () => {
          selects += 1;
          return selects === 1 ? [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" }] : selects === 2 ? [{ id: "sessao-herdada", mapId: null }, { id: "sessao-explicita", mapId: "map-novo" }] : selects === 3 ? [novoMapa] : selects === 4 ? [assento] : selects === 5 ? [{ id: "event-1", defaultMapId: "map-novo" }] : [];
        } }) }),
        update: () => ({ set: () => ({ where: () => ({ returning: async () => [{ id: "event-1" }] }) }) }),
        insert: () => ({ values: () => ({ returning: async () => [{ id: "audit-1" }] }) }),
        transaction: async (fn: any) => fn(db),
      };
      const maps = new MapasService({ db } as any, undefined, {} as any);
      (maps as any).sincronizarInventarioMapa = sincronizar;
      await maps.substituirMapaPadrao("event-1", "map-novo", actor);
      expect(sincronizar).toHaveBeenCalledWith(db, "event-1", "map-novo", actor, ["sessao-herdada"]);
    });

    it("restaura evento, mapa, inventário e auditoria quando a transação falha", async () => {
      const state = { defaultMapId: "map-antigo", previousStatus: "CONFIRMADO", inventoryStatus: "DISPONIVEL", audits: 0 };
      let selects = 0;
      const update = (table: unknown) => ({ set: (values: any) => ({ where: () => ({ returning: async () => {
        if (table === (jest.requireMock("@essencia/db") as any).eventos) state.defaultMapId = values.defaultMapId;
        if (values.status === "ARQUIVADO") state.previousStatus = "ARQUIVADO";
        if (values.blockedReason) state.inventoryStatus = "BLOQUEADO";
        return [{ id: "event-1", defaultMapId: state.defaultMapId, status: state.previousStatus }];
      } }) }) });
      const db: any = {
        select: () => ({ from: () => ({ where: async () => {
          selects += 1;
          return selects === 1 ? [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" }] : selects === 2 ? [{ id: "sessao", mapId: null }] : selects === 3 ? [novoMapa] : selects === 4 ? [assento] : selects === 5 ? [{ id: "event-1", defaultMapId: "map-novo" }] : selects === 6 ? [{ id: "sessao", mapId: null }] : selects === 7 ? [] : [];
        } }) }),
        update,
        insert: () => ({ values: async () => { state.audits += 1; throw new Error("auditoria falhou"); } }),
      };
      db.transaction = async (fn: any) => {
        const snapshot = { ...state };
        try { return await fn(db); } catch (error) { Object.assign(state, snapshot); throw error; }
      };
      const maps = new MapasService({ db } as any, undefined, {} as any);
      (maps as any).sincronizarInventarioMapa = jest.fn().mockResolvedValue({ inventorySessionIds: ["sessao"], inventoryCreatedCount: 1 });
      await expect(maps.substituirMapaPadrao("event-1", "map-novo", actor)).rejects.toThrow("auditoria falhou");
      expect(state).toEqual({ defaultMapId: "map-antigo", previousStatus: "CONFIRMADO", inventoryStatus: "DISPONIVEL", audits: 0 });
    });

    it("remove preview somente após commit e ignora falha de limpeza", async () => {
      let selects = 0;
      const audits: any[] = [];
      const storage = { deleteFile: jest.fn().mockRejectedValue(new Error("storage indisponível")) };
      const db: any = {
        select: () => ({ from: () => ({ where: async () => {
          selects += 1;
          return selects === 1 ? [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" }] : selects === 2 ? [{ id: "sessao", mapId: null }] : selects === 3 ? [novoMapa] : selects === 4 ? [assento] : selects === 5 ? [{ id: "map-antigo", eventId: "event-1", previewFileKey: "preview/antigo.svg", status: "CONFIRMADO" }] : selects === 7 ? [{ id: "map-antigo", eventId: "event-1", previewFileKey: "preview/antigo.svg", status: "CONFIRMADO" }] : [];
        } }) }),
        update: () => ({ set: () => ({ where: () => ({ returning: async () => [{ id: "event-1" }] }) }) }),
        insert: () => ({ values: (values: any) => { audits.push(values); return { returning: async () => [{ id: "audit-1" }] }; } }),
        transaction: async (fn: any) => fn(db),
      };
      const maps = new MapasService({ db } as any, storage as any, {} as any);
      (maps as any).sincronizarInventarioMapa = jest.fn().mockResolvedValue({ inventorySessionIds: ["sessao"], inventoryCreatedCount: 1 });
      await expect(maps.substituirMapaPadrao("event-1", "map-novo", actor)).resolves.toMatchObject({ previousMapArchive: { code: "ARCHIVED" } });
      expect(storage.deleteFile).toHaveBeenCalledWith("preview/antigo.svg");
      expect(audits).toEqual(expect.arrayContaining([expect.objectContaining({ metadata: expect.objectContaining({ action: "substituir_mapa_padrao" }) })]));
    });
  });
  describe("capacidade da sessão igual aos lugares vendáveis", () => {
    function bancoQueRespeitaIds(estado: any) {
      const dbModule = jest.requireMock("@essencia/db") as any;
      dbModule.inArray.mockImplementation((_coluna: unknown, ids: string[]) => ({ ids }));
      dbModule.eq.mockImplementation((_coluna: unknown, valor: string) => ({ ids: [valor] }));
      const linhas = (tabela: unknown) => tabela === dbModule.eventos ? [estado.evento]
        : tabela === dbModule.eventoSessoes ? estado.sessoes
          : tabela === dbModule.eventoMapas ? estado.mapas
            : tabela === dbModule.eventoMapaAssentos ? estado.assentos
              : tabela === dbModule.eventoInventarioAssentos ? estado.inventario
                : [];
      const db: any = {
        select: () => ({ from: (tabela: unknown) => ({ where: () => {
          const consulta: any = Promise.resolve(linhas(tabela));
          consulta.for = () => consulta;
          consulta.orderBy = () => consulta;
          return consulta;
        } }) }),
        update: (tabela: unknown) => ({ set: (valores: any) => ({ where: (condicao: any) => {
          const aplicar = () => {
            if (tabela === dbModule.eventos) Object.assign(estado.evento, valores);
            if (tabela === dbModule.eventoSessoes) estado.sessoes.filter((sessao: any) => !condicao?.ids || condicao.ids.includes(sessao.id)).forEach((sessao: any) => Object.assign(sessao, valores));
            if (tabela === dbModule.eventoMapas) Object.assign(estado.mapas[0], valores);
          };
          aplicar();
          return { returning: async () => { aplicar(); return [tabela === dbModule.eventos ? estado.evento : estado.mapas[0]]; } };
        } }) }),
        delete: (tabela: unknown) => ({ where: async () => {
          if (tabela === dbModule.eventoInventarioAssentos) estado.inventario = [];
          if (tabela === dbModule.eventoMapas) estado.mapas = estado.mapas.filter((mapa: any) => mapa.id !== "map-antigo");
        } }),
        insert: (tabela: unknown) => ({ values: (valores: any) => {
          if (tabela === dbModule.eventoInventarioAssentos) estado.inventario.push({ id: `inv-${estado.inventario.length + 1}`, ...valores });
          if (tabela === dbModule.eventoAuditorias) estado.auditorias.push(valores);
          return { returning: async () => [{ id: "novo", ...valores }] };
        } }),
        transaction: async (fn: (tx: any) => Promise<unknown>) => fn(db),
      };
      return db;
    }

    afterEach(() => {
      const dbModule = jest.requireMock("@essencia/db") as any;
      dbModule.inArray.mockReset();
      dbModule.eq.mockReset();
    });

    it("substituir ajusta a capacidade das sessões herdadas aos lugares vendáveis do mapa novo", async () => {
      const estado: any = {
        evento: { id: "event-1", schoolId: "school-1", defaultMapId: null },
        mapas: [{ id: "map-novo", eventId: "event-1", status: "CONFIRMADO", previewFileKey: null }],
        sessoes: [
          { id: "sessao-herdada", eventId: "event-1", mapId: null, capacity: 784 },
          { id: "sessao-outro-mapa", eventId: "event-1", mapId: "map-outro", capacity: 500 },
        ],
        assentos: [
          { id: "a1", mapId: "map-novo", sellable: true },
          { id: "a2", mapId: "map-novo", sellable: false },
          { id: "a3", mapId: "map-novo", sellable: true },
        ],
        inventario: [],
        auditorias: [],
      };
      const maps = new MapasService({ db: bancoQueRespeitaIds(estado) } as any, undefined, {} as any);
      (maps as any).sincronizarInventarioMapa = jest.fn().mockResolvedValue({ inventorySessionIds: ["sessao-herdada"], inventoryCreatedCount: 3 });

      await maps.substituirMapaPadrao("event-1", "map-novo", actor);

      expect(estado.sessoes.find((sessao: any) => sessao.id === "sessao-herdada").capacity).toBe(2);
      expect(estado.sessoes.find((sessao: any) => sessao.id === "sessao-outro-mapa").capacity).toBe(500);
      expect(estado.auditorias[0].metadata).toEqual(expect.objectContaining({ action: "substituir_mapa_padrao", capacity: 2 }));
    });

    it("substituir não altera capacidade nem falha quando nenhuma sessão herda o mapa padrão", async () => {
      const estado: any = {
        evento: { id: "event-1", schoolId: "school-1", defaultMapId: null },
        mapas: [{ id: "map-novo", eventId: "event-1", status: "CONFIRMADO", previewFileKey: null }],
        sessoes: [{ id: "sessao-outro-mapa", eventId: "event-1", mapId: "map-outro", capacity: 500 }],
        assentos: [{ id: "a1", mapId: "map-novo", sellable: true }],
        inventario: [],
        auditorias: [],
      };
      const maps = new MapasService({ db: bancoQueRespeitaIds(estado) } as any, undefined, {} as any);
      (maps as any).sincronizarInventarioMapa = jest.fn().mockResolvedValue({ inventorySessionIds: [], inventoryCreatedCount: 0 });

      await maps.substituirMapaPadrao("event-1", "map-novo", actor);

      expect(estado.sessoes[0].capacity).toBe(500);
      expect(estado.auditorias[0].metadata.capacity).toBeNull();
    });

    it("migrar ajusta a capacidade das sessões migradas", async () => {
      const estado: any = {
        evento: { id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" },
        mapas: [
          { id: "map-antigo", eventId: "event-1", status: "CONFIRMADO", originalFileKey: null, previewFileKey: null },
          { id: "map-novo", eventId: "event-1", status: "CONFIRMADO" },
        ],
        sessoes: [{ id: "sessao-1", eventId: "event-1", mapId: "map-antigo", capacity: 784 }],
        assentos: [
          { id: "n1", mapId: "map-novo", sellable: true },
          { id: "n2", mapId: "map-novo", sellable: false },
          { id: "n3", mapId: "map-novo", sellable: true },
        ],
        inventario: [{ id: "inv-antigo", sessionId: "sessao-1", seatId: "velho-1", status: "DISPONIVEL" }],
        auditorias: [],
      };
      const maps = new MapasService({ db: bancoQueRespeitaIds(estado) } as any, undefined, {} as any);

      await maps.migrarSessoesEExcluir("event-1", "map-antigo", { targetMapId: "map-novo" }, actor);

      expect(estado.sessoes[0].capacity).toBe(2);
      expect(estado.auditorias[0].metadata).toEqual(expect.objectContaining({ action: "migrar_sessoes_e_excluir", capacity: 2 }));
    });
  });
});
