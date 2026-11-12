import { BadRequestException, Logger } from "@nestjs/common";
import "reflect-metadata";
jest.mock("@essencia/db", () => {
  const tabela = (nome: string) => Object.fromEntries(["id", "eventId", "mapId", "sessionId", "orderId", "inventorySeatId", "status", "createdAt", "version"].map((campo) => [campo, `${nome}.${campo}`]));
  const eq = (coluna: unknown, valor: unknown) => ({ tipo: "eq", coluna, valor });
  const and = (...condicoes: unknown[]) => ({ tipo: "and", condicoes });
  const inArray = (coluna: unknown, valores: unknown[]) => ({ tipo: "inArray", coluna, valores });
  const notInArray = (coluna: unknown, valores: unknown[]) => ({ tipo: "notInArray", coluna, valores });
  return {
    eventos: tabela("eventos"), eventoMapas: tabela("eventoMapas"), eventoSessoes: tabela("eventoSessoes"), eventoImportacoesMapa: tabela("eventoImportacoesMapa"), eventoDeteccoesMapa: tabela("eventoDeteccoesMapa"), eventoMapaAssentos: tabela("eventoMapaAssentos"), eventoInventarioAssentos: tabela("eventoInventarioAssentos"), eventoPedidos: tabela("eventoPedidos"), eventoItensPedido: tabela("eventoItensPedido"), eventoReservas: tabela("eventoReservas"), eventoIngressos: tabela("eventoIngressos"), eventoCheckins: tabela("eventoCheckins"), eventoOperacoesAdministrativas: tabela("eventoOperacoesAdministrativas"), eventoTransferencias: tabela("eventoTransferencias"), eventoAuditorias: tabela("eventoAuditorias"), eq: jest.fn(eq), and: jest.fn(and), or: jest.fn(and), inArray: jest.fn(inArray), notInArray: jest.fn(notInArray), asc: jest.fn((coluna: unknown) => ({ tipo: "asc", coluna })), desc: jest.fn((coluna: unknown) => ({ tipo: "desc", coluna })),
  };
});
import { MAX_PLANTA_PDF_BYTES, MapasService } from "./mapas.service";
import { StorageService } from "../../../common/storage/storage.service";

describe("MapasService", () => {
  const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };

  it("mantém StorageService como token de DI mesmo sendo opcional", () => {
    const selfParamTypes = Reflect.getMetadata("self:paramtypes", MapasService) as Array<{ index: number; param: unknown }>;
    expect(selfParamTypes).toEqual(expect.arrayContaining([{ index: 1, param: StorageService }]));
  });
  const PDF = Buffer.from("%PDF-1.7 planta");
  const arquivoPdf = (buffer: Buffer = PDF, mimetype = "application/pdf") => ({ filename: "planta.pdf", mimetype, toBuffer: jest.fn().mockResolvedValue(buffer) }) as any;
  const propostaFalsa = (lugares = 3, pontos = 1) => ({ versao: 1, revisao: 0, pagina: { numero: 1, largura: 8420, altura: 5950 }, lugares: Array.from({ length: lugares }, (_, i) => ({ id: `l${i}` })), rotulos: [], elementos: [], legenda: [], pontos: Array.from({ length: pontos }, (_, i) => ({ id: `p${i}` })) }) as any;

  function importacaoFixture(overrides: { maps?: any[]; sessions?: any[]; event?: any; gerar?: jest.Mock; imports?: any[]; seats?: any[]; inventory?: any[]; pedidos?: any[]; ingressos?: any[]; checkins?: any[]; operacoes?: any[] } = {}) {
    const dbModule = jest.requireMock("@essencia/db") as any;
    (dbModule.desc as jest.Mock).mockImplementation(() => "desc");
    const ordem: string[] = [];
    const state: any = {
      event: { id: "event-1", schoolId: "school-1", defaultMapId: null, ...overrides.event },
      maps: overrides.maps ?? [],
      sessions: overrides.sessions ?? [],
      imports: overrides.imports ?? [] as any[],
      seats: overrides.seats ?? [] as any[],
      inventory: overrides.inventory ?? [] as any[],
      pedidos: overrides.pedidos ?? [] as any[],
      ingressos: overrides.ingressos ?? [] as any[],
      checkins: overrides.checkins ?? [] as any[],
      operacoes: overrides.operacoes ?? [] as any[],
      audits: [] as any[],
      deteccoes: [] as any[],
      updates: [] as any[],
      lockEvents: [] as unknown[],
    };
    const rows = (table: unknown) => table === dbModule.eventos ? [state.event] : table === dbModule.eventoMapas ? state.maps : table === dbModule.eventoSessoes ? state.sessions : table === dbModule.eventoImportacoesMapa ? state.imports : table === dbModule.eventoMapaAssentos ? state.seats : table === dbModule.eventoInventarioAssentos ? state.inventory : table === dbModule.eventoPedidos ? state.pedidos : table === dbModule.eventoIngressos ? state.ingressos : table === dbModule.eventoCheckins ? state.checkins : table === dbModule.eventoOperacoesAdministrativas ? state.operacoes : [];
    const corresponde = (linha: any, condicao: any): boolean => {
      if (!condicao) return true;
      if (condicao.tipo === "and") return condicao.condicoes.every((item: any) => corresponde(linha, item));
      const campo = String(String(condicao.coluna ?? "").split(".").pop() ?? "");
      if (condicao.tipo === "inArray") return condicao.valores.includes(linha[campo]);
      if (condicao.tipo === "eq") return linha[campo] === condicao.valor;
      return true;
    };
    const select = () => ({ from: (table: unknown) => {
      let selectedRows: any[] | undefined;
      const consulta: any = {
        where: (condicao: unknown) => {
          selectedRows = rows(table).filter((linha: any) => corresponde(linha, condicao));
          return consulta;
        },
        orderBy: (ordenacao: unknown) => {
          selectedRows = ordenacao === "desc" ? [...(selectedRows ?? rows(table))].sort((x: any, y: any) => y.version - x.version) : (selectedRows ?? rows(table));
          return consulta;
        },
        then: (resolve: any, reject: any) => Promise.resolve(selectedRows ?? rows(table)).then(resolve, reject),
        for: () => { state.lockEvents.push(table); return consulta; },
      };
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
    return { maps, state, storage, gerar, ordem, db, dbModule };
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
    jest.spyOn(fx.maps as any, "transaction").mockImplementation(async (callback: any) => {
      await callback(fx.db);
      throw new Error("falha de banco");
    });
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
    expect(lista).toEqual({
      versoes: [
        { id: "m2", version: 2, status: "CONFIRMADO", originalFileName: "b.pdf", createdAt: new Date("2026-02-01"), confirmedAt: new Date("2026-02-02"), atual: false, lugares: 0, sessoes: [], editavel: false },
        { id: "m1", version: 1, status: "ARQUIVADO", originalFileName: "a.pdf", createdAt: new Date("2026-01-01"), confirmedAt: null, atual: false, lugares: 0, sessoes: [], editavel: false },
      ],
      trava: { tipo: "LIVRE", mensagem: null },
    });
    const outra = importacaoFixture({ maps, event: { schoolId: "school-2" } });
    await expect(outra.maps.listar("event-1", actor)).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
  });

  it("lista versões com atual, lugares, sessões, editavel e trava LIVRE", async () => {
    const startsAt = new Date("2026-12-07T20:00:00Z");
    const maps = [
      { id: "m1", eventId: "event-1", version: 1, status: "ARQUIVADO", originalFileName: "antigo.pdf", createdAt: new Date("2026-01-01"), confirmedAt: new Date("2026-01-02") },
      { id: "m2", eventId: "event-1", version: 2, status: "CONFIRMADO", originalFileName: "atual.pdf", createdAt: new Date("2026-02-01"), confirmedAt: new Date("2026-02-02") },
      { id: "m3", eventId: "event-1", version: 3, status: "EM_REVISAO", originalFileName: "rascunho.pdf", createdAt: new Date("2026-03-01"), confirmedAt: null },
    ];
    const fx = importacaoFixture({
      event: { defaultMapId: "m2" },
      maps,
      imports: [
        { id: "imp-2", eventId: "event-1", mapId: "m2", proposta: propostaFalsa(3) },
        { id: "imp-3", eventId: "event-1", mapId: "m3", proposta: propostaFalsa(4) },
      ],
      seats: [
        { id: "seat-1", mapId: "m1" },
        { id: "seat-2", mapId: "m2" },
        { id: "seat-3", mapId: "m2" },
        { id: "seat-4", mapId: "m2" },
      ],
      sessions: [
        { id: "s1", eventId: "event-1", mapId: "m2", startsAt },
        { id: "s2", eventId: "event-1", mapId: "m1", startsAt: new Date("2026-12-08T20:00:00Z") },
      ],
    });

    await expect(fx.maps.listar("event-1", actor)).resolves.toEqual({
      versoes: [
        expect.objectContaining({ id: "m3", version: 3, status: "EM_REVISAO", lugares: 4, sessoes: [], editavel: false, atual: false }),
        expect.objectContaining({ id: "m2", version: 2, status: "CONFIRMADO", lugares: 3, sessoes: [{ id: "s1", startsAt }], editavel: true, atual: true }),
        expect.objectContaining({ id: "m1", version: 1, status: "ARQUIVADO", lugares: 1, sessoes: [{ id: "s2", startsAt: new Date("2026-12-08T20:00:00Z") }], editavel: false, atual: false }),
      ],
      trava: { tipo: "LIVRE", mensagem: null },
    });
  });

  it("lista sessão legada sem mapId na versão indicada pelo inventário antigo", async () => {
    const startsAt = new Date("2026-12-07T20:00:00Z");
    const fx = importacaoFixture({
      event: { defaultMapId: "m2" },
      maps: [
        { id: "m1", eventId: "event-1", version: 1, status: "ARQUIVADO", createdAt: new Date("2026-01-01"), confirmedAt: null },
        { id: "m2", eventId: "event-1", version: 2, status: "CONFIRMADO", createdAt: new Date("2026-02-01"), confirmedAt: new Date("2026-02-02") },
      ],
      sessions: [{ id: "s1", eventId: "event-1", mapId: null, startsAt }],
      seats: [{ id: "seat-old", mapId: "m1" }],
      inventory: [{ id: "inventory-old", sessionId: "s1", seatId: "seat-old" }],
    });

    const versoes = (await fx.maps.listar("event-1", actor)).versoes;
    expect(versoes.find((versao) => versao.id === "m1")?.sessoes).toEqual([{ id: "s1", startsAt }]);
  });

  it("lista devolve a trava com a mensagem quando há venda confirmada", async () => {
    const fx = importacaoFixture({ pedidos: [{ id: "pedido-1", eventId: "event-1", status: "CONFIRMADO", expiresAt: null }] });
    await expect(fx.maps.listar("event-1", actor)).resolves.toMatchObject({
      trava: { tipo: "VENDA_CONFIRMADA", mensagem: "Bloqueado: já há lugares vendidos com pagamento confirmado neste evento." },
    });
  });

  it("importar recusa com VENDA_CONFIRMADA sem chamar o gerador nem o storage", async () => {
    const fx = importacaoFixture({ pedidos: [{ id: "pedido-1", eventId: "event-1", status: "CONFIRMADO", expiresAt: null }] });
    await expect(fx.maps.importar("event-1", arquivoPdf(), actor)).rejects.toMatchObject({ response: { code: "VENDA_CONFIRMADA" } });
    expect(fx.gerar).not.toHaveBeenCalled();
    expect(fx.storage.uploadMapBuffer).not.toHaveBeenCalled();
  });

  it.each([
    ["COMPRA_EM_ANDAMENTO", { status: "AGUARDANDO_PAGAMENTO", expiresAt: new Date(Date.now() + 60_000) }],
    ["OPERACAO_ATIVA", undefined],
  ])("importar recusa com %s antes de ler ou enviar a planta", async (codigo, pedido) => {
    const fx = importacaoFixture({
      pedidos: pedido ? [{ id: "pedido-1", eventId: "event-1", status: pedido.status, expiresAt: pedido.expiresAt }] : [],
      operacoes: pedido ? [] : [{ id: "operacao-1", eventId: "event-1", status: "ATIVA" }],
    });
    const arquivo = arquivoPdf();

    await expect(fx.maps.importar("event-1", arquivo, actor)).rejects.toMatchObject({ response: { code: codigo } });
    expect(arquivo.toBuffer).not.toHaveBeenCalled();
    expect(fx.gerar).not.toHaveBeenCalled();
    expect(fx.storage.uploadMapBuffer).not.toHaveBeenCalled();
  });

  it("importar adquire os locks na ordem global antes de ler a planta", async () => {
    const fx = importacaoFixture();
    await fx.maps.importar("event-1", arquivoPdf(), actor);
    expect(fx.state.lockEvents.slice(0, 6)).toEqual([
      fx.dbModule.eventos,
      fx.dbModule.eventoSessoes,
      fx.dbModule.eventoMapas,
      fx.dbModule.eventoImportacoesMapa,
      fx.dbModule.eventoInventarioAssentos,
      fx.dbModule.eventoPedidos,
    ]);
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

  it("sincroniza sessões herdadas e explícitas com idempotência, estados e auditoria", async () => {
    const dbModule = jest.requireMock("@essencia/db") as typeof import("@essencia/db");
    const state = {
      event: { id: "event-1", defaultMapId: "map-1" },
      sessions: [
        { id: "session-inherited", eventId: "event-1", mapId: null },
        { id: "session-specific", eventId: "event-1", mapId: "map-1" },
        { id: "session-other-map", eventId: "event-1", mapId: "map-2" },
      ],
      seats: [
        { id: "seat-available", mapId: "map-1", sellable: true },
        { id: "seat-blocked", mapId: "map-1", sellable: false },
      ],
      inventory: [
        { id: "inventory-inherited", sessionId: "session-inherited", seatId: "seat-available", status: "RESERVADO" },
        { id: "inventory-specific", sessionId: "session-specific", seatId: "seat-blocked", status: "BLOQUEADO", blockedReason: "motivo-existente" },
      ],
      audits: [] as any[],
    };
    const corresponde = (linha: any, condicao: any): boolean => {
      if (!condicao) return true;
      const campo = String(String(condicao.coluna ?? "").split(".").pop() ?? "");
      return condicao.tipo === "eq" ? linha[campo] === condicao.valor : true;
    };
    const db: any = {
      select: () => ({ from: (table: unknown) => ({ where: (condicao: unknown) => Promise.resolve(
        table === dbModule.eventos ? [state.event]
          : table === dbModule.eventoSessoes ? state.sessions
            : table === dbModule.eventoMapaAssentos ? state.seats
              : table === dbModule.eventoInventarioAssentos ? state.inventory.filter((linha) => corresponde(linha, condicao))
                : [],
      ) }) }),
      insert: (table: unknown) => ({ values: (values: any) => {
        if (table === dbModule.eventoInventarioAssentos) state.inventory.push({ id: `inventory-${state.inventory.length + 1}`, ...values });
        if (table === dbModule.eventoAuditorias) state.audits.push(values);
        return Promise.resolve();
      } }),
    };
    const maps = new MapasService({ db } as any, undefined, {} as any);

    await maps.sincronizarInventarioMapa(db, "event-1", "map-1", actor);

    expect(state.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionId: "session-inherited", seatId: "seat-available", status: "RESERVADO" }),
      expect.objectContaining({ sessionId: "session-inherited", seatId: "seat-blocked", status: "BLOQUEADO", blockedReason: "MAPA_ASSENTO_NAO_VENDAVEL" }),
      expect.objectContaining({ sessionId: "session-specific", seatId: "seat-blocked", status: "BLOQUEADO", blockedReason: "motivo-existente" }),
      expect.objectContaining({ sessionId: "session-specific", seatId: "seat-available", status: "DISPONIVEL", blockedReason: null }),
    ]));
    expect(state.inventory).toHaveLength(4);
    expect(state.inventory.some((linha) => linha.sessionId === "session-other-map")).toBe(false);
    expect(state.audits).toEqual([expect.objectContaining({
      metadata: { action: "gerar_inventario", inventorySessionIds: ["session-inherited", "session-specific"], inventoryCreatedCount: 2 },
    })]);
  });

  it("não reinsere assentos antigos se a sessão mudar de mapa durante a sincronização", async () => {
    const dbModule = jest.requireMock("@essencia/db") as typeof import("@essencia/db");
    const state: any = {
      event: { id: "event-1", defaultMapId: "map-new" },
      session: { id: "session-1", eventId: "event-1", mapId: "map-old" },
      seats: [{ id: "seat-old", mapId: "map-old", sellable: true }],
      inventory: [],
      audits: [],
    };
    let existingRead = false;
    const db: any = {
      select: () => ({ from: (table: unknown) => ({ where: (condition: any) => {
        const query: any = {
          then: (resolve: any, reject: any) => {
            let rows: any[] = [];
            if (table === dbModule.eventos) rows = [state.event];
            if (table === dbModule.eventoSessoes) rows = [state.session];
            if (table === dbModule.eventoMapaAssentos) rows = state.seats;
            if (table === dbModule.eventoInventarioAssentos) {
              rows = state.inventory.filter((item: any) => item.sessionId === "session-1");
              if (!existingRead) {
                existingRead = true;
                state.session.mapId = "map-new";
                state.event.defaultMapId = "map-new";
              }
            }
            return Promise.resolve(rows).then(resolve, reject);
          },
          for: () => query,
        };
        return query;
      } }) }),
      insert: (table: unknown) => ({ values: (values: any) => {
        if (table === dbModule.eventoInventarioAssentos) state.inventory.push(values);
        if (table === dbModule.eventoAuditorias) state.audits.push(values);
        return Promise.resolve();
      } }),
    };
    const maps = new MapasService({ db } as any, undefined, {} as any);

    await maps.sincronizarInventarioMapa(db, "event-1", "map-old", actor);

    expect(state.inventory).toEqual([]);
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

    it.each([
      ["VENDA_CONFIRMADA", { pedidos: [{ id: "pedido-1", eventId: "event-1", status: "CONFIRMADO", expiresAt: null }] }],
      ["COMPRA_EM_ANDAMENTO", { pedidos: [{ id: "pedido-1", eventId: "event-1", status: "AGUARDANDO_PAGAMENTO", expiresAt: new Date(Date.now() + 60_000) }] }],
      ["OPERACAO_ATIVA", { operacoes: [{ id: "operacao-1", eventId: "event-1", status: "ATIVA" }] }],
    ])("editarProposta recusa quando a trava é %s", async (codigo, opcoes) => {
      const fx = fixture(opcoes as any);
      await expect(fx.maps.editarProposta("event-1", "map-1", editar(2, [{ tipo: "CONFERIR_PONTO", pontoId: "p1" }]) as any, actor))
        .rejects.toMatchObject({ response: { code: codigo } });
      expect(fx.state.impUpdates).toHaveLength(0);
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
        lockEvents: [], orderByCalls: [],
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
          q.orderBy = (...ordens: any[]) => { state.orderByCalls.push({ table, ordens }); selecionadas.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))); return q; };
          q.for = (modo: string) => { state.lockEvents.push({ table, modo, ids: selecionadas.map((linha: any) => linha.id) }); return q; };
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
      expect(fx.state.audits).toEqual(expect.arrayContaining([expect.objectContaining({ metadata: { action: "excluir_versao", sessionIds: ["session-1"] } })]));
      const dbModule = jest.requireMock("@essencia/db") as any;
      expect(fx.state.lockEvents.map((evento: any) => evento.table)).toEqual([
        dbModule.eventos,
        dbModule.eventoSessoes,
        dbModule.eventoMapas,
        dbModule.eventoImportacoesMapa,
        dbModule.eventoInventarioAssentos,
        dbModule.eventoPedidos,
        dbModule.eventoItensPedido,
        dbModule.eventoReservas,
        dbModule.eventoOperacoesAdministrativas,
      ]);
    });

    it("leva sessão legada sem mapId quando o inventário aponta para assento da versão excluída", async () => {
      const fx = exclusaoFixture({
        sessions: [{ id: "session-1", eventId: "event-1", mapId: null, capacity: 1 }],
        seats: [
          { id: "seat-current", mapId: "map-current", sellable: true, rowLabel: "A", seatNumber: "1" },
          { id: "seat-old", mapId: "map-delete", sellable: true, rowLabel: "A", seatNumber: "1" },
        ],
        inventory: [{ id: "inventory-delete", sessionId: "session-1", seatId: "seat-old", status: "DISPONIVEL" }],
      });

      await expect(fx.maps.excluirVersao("event-1", "map-delete", actor)).resolves.toEqual({ excluida: true, sessionIds: ["session-1"] });
      expect(fx.state.sessions[0]).toEqual(expect.objectContaining({ mapId: "map-current" }));
      expect(fx.state.inventory).toEqual([expect.objectContaining({ sessionId: "session-1", seatId: "seat-current" })]);
    });

    it("preserva operação encerrada ao recriar o inventário da sessão", async () => {
      const fx = exclusaoFixture({ operacoes: [{ id: "operacao-1", sessionId: "session-1", inventorySeatId: "inventory-delete", status: "CANCELADA" }] });
      await expect(fx.maps.excluirVersao("event-1", "map-delete", actor)).resolves.toEqual({ excluida: true, sessionIds: ["session-1"] });
      expect(fx.state.operacoes).toEqual([expect.objectContaining({ id: "operacao-1", status: "CANCELADA", inventorySeatId: "inventory-delete" })]);
      expect(fx.state.inventory).toEqual([expect.objectContaining({ id: "inventory-delete", seatId: "seat-current" })]);
    });

    it("recusa operação ativa antes de alterar o inventário", async () => {
      const fx = exclusaoFixture({ operacoes: [{ id: "operacao-1", sessionId: "session-1", inventorySeatId: "inventory-delete", status: "ATIVA" }] });
      await expect(fx.maps.excluirVersao("event-1", "map-delete", actor)).rejects.toMatchObject({ response: { code: "OPERACAO_ATIVA" } });
      expect(fx.state.maps).toHaveLength(2);
      expect(fx.state.inventory).toEqual([expect.objectContaining({ id: "inventory-delete", seatId: "seat-old" })]);
    });

    it("recusa a versão atual com MAPA_ATUAL", async () => {
      const fx = exclusaoFixture();
      await expect(fx.maps.excluirVersao("event-1", "map-current", actor)).rejects.toMatchObject({ response: { code: "MAPA_ATUAL", message: "A versão atual não pode ser excluída." } });
      expect(fx.state.maps).toHaveLength(2);
    });

    it("recusa MAPA_ATUAL antes da trava mesmo com compra em andamento", async () => {
      const fx = exclusaoFixture({ pedidos: [{ id: "pedido-1", eventId: "event-1", status: "AGUARDANDO_PAGAMENTO", expiresAt: new Date(Date.now() + 60_000) }] });
      await expect(fx.maps.excluirVersao("event-1", "map-current", actor)).rejects.toMatchObject({ response: { code: "MAPA_ATUAL" } });
      expect(fx.state.maps).toHaveLength(2);
      expect(fx.state.lockEvents).toHaveLength(1);
      expect(fx.state.lockEvents[0].table).toBe((jest.requireMock("@essencia/db") as any).eventos);
    });

    it("recusa MAPA_ATUAL quando o evento não tem versão atual", async () => {
      const fx = exclusaoFixture({ event: { id: "event-1", schoolId: "school-1", defaultMapId: null }, pedidos: [{ id: "pedido-1", eventId: "event-1", status: "AGUARDANDO_PAGAMENTO", expiresAt: new Date(Date.now() + 60_000) }] });
      await expect(fx.maps.excluirVersao("event-1", "map-delete", actor)).rejects.toMatchObject({ response: { code: "MAPA_ATUAL" } });
      expect(fx.state.maps).toHaveLength(2);
      expect(fx.state.lockEvents).toHaveLength(1);
      expect(fx.state.lockEvents[0].table).toBe((jest.requireMock("@essencia/db") as any).eventos);
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


});
