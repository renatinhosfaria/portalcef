import { BadRequestException } from "@nestjs/common";
import "reflect-metadata";
jest.mock("@essencia/db", () => ({ eventos: {}, eventoMapas: {}, eventoSessoes: {}, eventoImportacoesMapa: {}, eventoDeteccoesMapa: {}, eventoMapaAssentos: {}, eventoInventarioAssentos: {}, eventoPedidos: {}, eventoReservas: {}, eventoIngressos: {}, eventoCheckins: {}, eventoOperacoesAdministrativas: {}, eventoAuditorias: {}, eq: jest.fn(), and: jest.fn(), inArray: jest.fn(), desc: jest.fn() }));
import { MapasService } from "./mapas.service";
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
      pedidos: [], reservas: [], ingressos: [], checkins: [], operacoes: [], audits: [],
      ...overrides,
    };
    const rows = (table: unknown) => table === dbModule.eventos ? [state.event]
      : table === dbModule.eventoSessoes ? state.sessions : table === dbModule.eventoMapas ? state.maps
        : table === dbModule.eventoMapaAssentos ? state.seats : table === dbModule.eventoInventarioAssentos ? state.inventory
          : table === dbModule.eventoPedidos ? state.pedidos : table === dbModule.eventoReservas ? state.reservas
            : table === dbModule.eventoIngressos ? state.ingressos : table === dbModule.eventoCheckins ? state.checkins
              : table === dbModule.eventoOperacoesAdministrativas ? state.operacoes : table === dbModule.eventoAuditorias ? state.audits : [];
    const db: any = {
      select: () => ({ from: (table: unknown) => ({ where: () => {
        const query: any = Promise.resolve(rows(table));
        query.for = () => query;
        return query;
      } }) }),
      update: (table: unknown) => ({ set: (values: any) => ({ where: () => {
        if (table === dbModule.eventos) Object.assign(state.event, values);
        if (table === dbModule.eventoSessoes) state.sessions.forEach((session: any) => Object.assign(session, values));
        return { returning: async () => table === dbModule.eventos ? [state.event] : state.sessions };
      } }) }),
      delete: (table: unknown) => ({ where: async () => {
        if (table === dbModule.eventoInventarioAssentos) state.inventory = [];
        if (table === dbModule.eventoMapas) state.maps = state.maps.filter((map: any) => map.id !== "map-old");
      } }),
      insert: (table: unknown) => ({ values: (values: any) => {
        if (table === dbModule.eventoInventarioAssentos) state.inventory.push({ id: `inventory-${state.inventory.length + 1}`, ...values });
        if (table === dbModule.eventoAuditorias) state.audits.push(values);
        return { returning: async () => [{ id: `inserted-${state.audits.length}`, ...values }] };
      } }),
      transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const storage = { deleteFile: jest.fn().mockResolvedValue(undefined) };
    return { state, db, maps: new MapasService({ db } as any, storage as any, {} as any), storage };
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
  function service() {
    const db: any = {
      select: () => ({ from: () => ({ where: async () => [{ id: "event-1", schoolId: "school-1", status: "EM_REVISAO" }] }) }),
      insert: () => ({ values: () => ({ returning: async () => [{ id: "map-1", eventId: "event-1" }] }) }),
    };
    return new MapasService({ db } as any, { uploadMapBuffer: jest.fn().mockResolvedValue({ key: "private/map.svg" }) } as any, { detect: jest.fn().mockResolvedValue({ detector: "svg-text-v1", seats: [{ rowLabel: "A", seatNumber: "1", x: 1, y: 2, width: 20, height: 20, confidence: 90 }], categories: [], confidence: 90, conflicts: [] }) } as any);
  }
  it("mantém StorageService como token de DI mesmo sendo opcional", () => {
    const selfParamTypes = Reflect.getMetadata("self:paramtypes", MapasService) as Array<{ index: number; param: unknown }>;
    expect(selfParamTypes).toEqual(expect.arrayContaining([{ index: 1, param: StorageService }]));
  });
  it("exige revisão humana para toda confirmação estruturada", async () => {
    const maps = service();
    const result = await maps.importar("event-1", { filename: "map.svg", mimetype: "image/svg+xml", toBuffer: jest.fn().mockResolvedValue(Buffer.from("<svg/>")) } as any, actor);
    expect(result.status).toBe("EM_REVISAO");
    expect(result.proposalCount).toBe(1);
    const upload = (maps as any).storage.uploadMapBuffer as jest.Mock;
    expect(upload).toHaveBeenNthCalledWith(1, expect.any(Buffer), "map.svg", "image/svg+xml", "eventos/event-1/mapas/originais");
    expect(upload).toHaveBeenNthCalledWith(2, expect.any(Buffer), "preview-map.svg", "image/svg+xml", "eventos/event-1/mapas/previews");
  });

  it("rejeita confirmação sem assentos", async () => {
    const db: any = { select: () => ({ from: () => ({ where: async () => [{ id: "event-1", schoolId: "school-1" }] }) }) };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    await expect(maps.confirmar("event-1", "map-1", { seats: [] }, actor)).rejects.toBeInstanceOf(BadRequestException);
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
          if (selectCall === 4) return [{ id: "import-1" }];
          if (selectCall === 5) return [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-1" }];
          if (selectCall === 6) return sessions;
          if (selectCall === 7) return mapSeats;
          if (selectCall === 8) return existingInventory.filter((item) => item.sessionId === "session-inherited");
          if (selectCall === 9) return existingInventory.filter((item) => item.sessionId === "session-specific");
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

    const result = await maps.confirmar("event-1", "map-1", {
      seats: mapSeats.map((seat) => ({ rowLabel: seat.rowLabel, seatNumber: seat.seatNumber, x: 1, y: 1, sellable: seat.sellable })),
    }, actor);

    const inventoryInserts = inserted.filter((item) => item.table === dbModule.eventoInventarioAssentos);
    expect(inventoryInserts.map((item) => item.values)).toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionId: "session-inherited", seatId: "seat-2", status: "BLOQUEADO" }),
      expect.objectContaining({ sessionId: "session-specific", seatId: "seat-1", status: "DISPONIVEL" }),
    ]));
    expect(inventoryInserts).toHaveLength(2);
    expect(result.inventorySessionIds).toEqual(expect.arrayContaining(["session-inherited", "session-specific"]));
    expect(result.inventoryCreatedCount).toBe(2);
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

    const confirmed = await maps.confirmar("event-1", "map-primeiro", { seats }, actor);
    const replaced = await maps.substituirMapaPadrao("event-1", "map-primeiro", actor);

    expect(confirmed.inventoryCreatedCount).toBe(0);
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
    await expect(maps.confirmar("event-1", "map-1", { seats: [{ rowLabel: "A", seatNumber: "1", x: 1, y: 1 }] }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(maps.arquivar("event-1", "map-1", actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persiste uma correção de detecção com revisor e motivo", async () => {
    const update = jest.fn(() => ({ set: () => ({ where: async () => undefined }) }));
    const insert = jest.fn(() => ({ values: () => ({ returning: async () => [{ id: "detection-2" }] }) }));
    let call = 0;
    const db: any = { select: () => ({ from: () => ({ where: async () => { call += 1; return call === 1 ? [{ id: "event-1", schoolId: "school-1" }] : call === 2 ? [{ id: "map-1", eventId: "event-1", status: "EM_REVISAO" }] : [{ id: "imp-1" }]; } }) }), update, insert };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    (maps as any).revisao = jest.fn().mockResolvedValue({});
    await maps.atualizarDeteccoes("event-1", "map-1", { reason: "ajuste manual", seats: [{ id: "det-1", rowLabel: "B", seatNumber: "4", x: 20, y: 30 }] }, actor);
    expect(update).toHaveBeenCalled();
  });

  it.each(["CONFIRMADO", "ARQUIVADO"])("rejeita correção em mapa %s sem atualizar detecções", async (status) => {
    const update = jest.fn();
    let call = 0;
    const db: any = { select: () => ({ from: () => ({ where: async () => {
      call += 1;
      return call === 1 ? [{ id: "event-1", schoolId: "school-1" }] : [{ id: "map-1", eventId: "event-1", status }];
    } }) }), update };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    await expect(maps.atualizarDeteccoes("event-1", "map-1", { reason: "ajuste", seats: [{ id: "det-1", rowLabel: "A", seatNumber: "1", x: 1, y: 1 }] }, actor)).rejects.toMatchObject({ response: { code: "MAP_NOT_IN_REVIEW" } });
    expect(update).not.toHaveBeenCalled();
  });

  it("não conclui correção quando auditoria transacional falha", async () => {
    const update = jest.fn(() => ({ set: () => ({ where: async () => undefined }) }));
    let call = 0;
    const db: any = { select: () => ({ from: () => ({ where: async () => { call += 1; return call === 1 ? [{ id: "event-1", schoolId: "school-1" }] : call === 2 ? [{ id: "map-1", eventId: "event-1", status: "EM_REVISAO" }] : [{ id: "imp-1" }]; } }) }), update, transaction: async (fn: any) => fn({ update, insert: () => ({ values: async () => { throw new Error("audit failed"); } }) }) };
    const maps = new MapasService({ db } as any, undefined, {} as any);
    await expect(maps.atualizarDeteccoes("event-1", "map-1", { reason: "falha", seats: [{ id: "det-1", rowLabel: "A", seatNumber: "1", x: 1, y: 1 }] }, actor)).rejects.toThrow("audit failed");
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
        if (table === dbModule.eventoMapas) return [state.maps[mapSelects++]];
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
      expect(result.previousMapArchive).toEqual({ archived: false, code: "MAP_IN_USE", sessionIds: ["sessao-explicita-antigo"] });
      expect(storage.deleteFile).not.toHaveBeenCalled();
    });

    it("desfaz todas as mutações do fake transacional quando a auditoria falha após o inventário", async () => {
      const fake = fakeTransacional({ falharNoSegundoAudit: true });
      const before = JSON.parse(JSON.stringify(fake.state));
      await expect(new MapasService({ db: fake.db } as any, undefined, {} as any).substituirMapaPadrao("event-1", "map-novo", actor)).rejects.toThrow("auditoria falhou");
      expect(fake.state).toEqual(before);
      expect(fake.inventorySelects).toBe(1);
    });

    it("remove o preview somente depois do commit e não desfaz a troca se o storage falhar", async () => {
      const storage = { deleteFile: jest.fn() };
      const fake = fakeTransacional({ storage });
      storage.deleteFile.mockImplementation(async () => {
        expect(fake.committed).toBe(true);
        throw new Error("storage indisponível");
      });
      fake.state.sessions = fake.state.sessions.filter((session: any) => session.id !== "sessao-explicita-antigo");
      const result = await new MapasService({ db: fake.db } as any, storage as any, {} as any).substituirMapaPadrao("event-1", "map-novo", actor);
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
          return selects === 1 ? [{ id: "event-1", schoolId: "school-1", defaultMapId: "map-antigo" }] : selects === 2 ? [{ id: "sessao", mapId: null }] : selects === 3 ? [novoMapa] : selects === 4 ? [assento] : selects === 5 ? [{ id: "map-antigo", eventId: "event-1", previewFileKey: "preview/antigo.svg", status: "CONFIRMADO" }] : [];
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
});
