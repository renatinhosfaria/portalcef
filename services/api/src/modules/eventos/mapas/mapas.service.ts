import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { and, asc, desc, eq, inArray, or, eventoAuditorias, eventoCheckins, eventoDeteccoesMapa, eventoImportacoesMapa, eventoIngressos, eventoInventarioAssentos, eventoItensPedido, eventoMapaAssentos, eventoMapas, eventoOperacoesAdministrativas, eventoPedidos, eventoReservas, eventoSessoes, eventoTransferencias, eventos, type Database } from "@essencia/db";
import type { MultipartFile } from "@fastify/multipart";
import type { EventoActor } from "@essencia/shared/types";
import { DatabaseService } from "../../../common/database/database.service";
import { StorageService } from "../../../common/storage/storage.service";
import { ErroProposta, aplicarOperacoes, pendenciasPublicacao, type LayoutMapa, type MetadadosAssento, type OperacaoProposta, type PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import { GeradorMapaPdf } from "./gerador/gerador-mapa-pdf";
import { propostaParaConfirmacao } from "./gerador/proposta-para-confirmacao";
import { carregarTrava, exigirMapaLivre, MENSAGEM_TRAVA, type TipoTrava } from "./trava-venda";
import { levarSessoesParaVersao } from "./levar-sessoes";

/**
 * Teto de tamanho da planta em PDF. O pdf.js lê o arquivo inteiro na memória da API e roda no mesmo
 * processo das demais requisições, então um PDF enorme pode travar tudo. Plantas vetoriais exportadas
 * do programa de desenho ficam muito abaixo disso.
 */
export const MAX_PLANTA_PDF_BYTES = 10 * 1024 * 1024;

export interface ConfirmMapInput { seats: Array<{ id?: string; rowLabel: string; seatNumber: string; x: number; y: number; width?: number; height?: number; category?: string | null; accessible?: boolean; sellable?: boolean; metadata?: MetadadosAssento }>; layout?: LayoutMapa; revisaoEsperada?: number; reason?: string; }
export interface MapImportSummary { importId: string; mapId: string; status: string; proposalCount: number; conflictCount: number; }
export interface VersaoMapaResumo {
  id: string;
  version: number;
  status: "EM_REVISAO" | "CONFIRMADO" | "ARQUIVADO";
  originalFileName: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  atual: boolean;
  lugares: number;
  sessoes: Array<{ id: string; startsAt: Date }>;
  editavel: boolean;
}
export interface MapReplacementResult {
  updated: unknown;
  previousMapId: string | null;
  inheritedSessionIds: string[];
  inventorySessionIds: string[];
  inventoryCreatedCount: number;
  previousMapArchive: { archived: boolean; code: "ARCHIVED" | "MAP_IN_USE" | "NO_PREVIOUS_MAP"; sessionIds?: string[] };
}
export interface MapMigrationResult {
  oldMapId: string;
  targetMapId: string;
  migratedSessionIds: string[];
  inheritedSessionIds: string[];
  inventoryCreatedCount: number;
  deletedMap: { deleted: true; code: "DELETED" };
}

@Injectable()
export class MapasService {
  private readonly logger = new Logger(MapasService.name);
  constructor(private readonly database: DatabaseService, @Optional() @Inject(StorageService) private readonly storage: StorageService | undefined, private readonly gerador: GeradorMapaPdf) {}
  private get db(): Database { return this.database.db; }
  private async assertEvent(eventId: string, actor: EventoActor) {
    const [event] = await this.db.select().from(eventos).where(eq(eventos.id, eventId));
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    if (actor.role !== "master" && event.schoolId !== actor.schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });
    return event;
  }
  private async audit(eventId: string, actor: EventoActor, resourceId: string, metadata: unknown, db: Database = this.db) {
    if (typeof (db as any).insert === "function") await db.insert(eventoAuditorias).values({ eventId, actorId: actor.userId, actorRole: actor.role, action: "ATUALIZADO", resourceType: "mapa", resourceId, metadata });
  }
  private async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    const tx = (this.db as any).transaction;
    return typeof tx === "function" ? tx.call(this.db, fn) : fn(this.db);
  }
  private async lockRows<T = any>(query: any): Promise<T[]> {
    const locked = typeof query?.for === "function" ? query.for("update") : query;
    return locked;
  }

  private normalizarResultadoArquivamento(value: unknown): MapReplacementResult["previousMapArchive"] | null {
    if (!value || typeof value !== "object") return null;
    const archive = value as { archived?: unknown; code?: unknown; sessionIds?: unknown };
    if (typeof archive.archived !== "boolean" || !["ARCHIVED", "MAP_IN_USE", "NO_PREVIOUS_MAP"].includes(String(archive.code))) return null;
    const code = archive.code as MapReplacementResult["previousMapArchive"]["code"];
    if ((code === "ARCHIVED" && archive.archived !== true) || (code !== "ARCHIVED" && archive.archived !== false)) return null;
    if (archive.sessionIds !== undefined && !Array.isArray(archive.sessionIds)) return null;
    return { archived: archive.archived, code, ...(archive.sessionIds ? { sessionIds: archive.sessionIds.filter((id): id is string => typeof id === "string") } : {}) };
  }

  private async recuperarResultadoIdempotente(db: Database, event: any, mapId: string, sessions: any[]) {
    const auditBaseQuery = db.select().from(eventoAuditorias).where(and(eq(eventoAuditorias.eventId, event.id), eq(eventoAuditorias.resourceType, "mapa"), eq(eventoAuditorias.resourceId, event.id)));
    const auditQuery = typeof (auditBaseQuery as any).orderBy === "function"
      ? (auditBaseQuery as any).orderBy(desc(eventoAuditorias.createdAt))
      : auditBaseQuery;
    const audits = await auditQuery;
    const record = [...(audits ?? [])].find((audit: any) => {
      const metadata = audit?.metadata;
      return metadata?.action === "substituir_mapa_padrao" && metadata.nextMapId === mapId;
    });
    if (record) {
      const metadata = record.metadata as any;
      const archive = this.normalizarResultadoArquivamento(metadata.previousMapArchive);
      if (archive) {
        return {
          updated: event,
          previousMapId: typeof metadata.previousMapId === "string" ? metadata.previousMapId : null,
          inheritedSessionIds: Array.isArray(metadata.inheritedSessionIds) ? metadata.inheritedSessionIds : [],
          inventory: {
            inventorySessionIds: Array.isArray(metadata.inventorySessionIds) ? metadata.inventorySessionIds : [],
            inventoryCreatedCount: typeof metadata.inventoryCreatedCount === "number" ? metadata.inventoryCreatedCount : 0,
          },
          previousMapArchive: archive,
          previousMapPreviewKey: null,
        };
      }
    }

    const maps = await db.select().from(eventoMapas).where(eq(eventoMapas.eventId, event.id));
    const current = maps.find((item: any) => item.id === mapId);
    const previous = maps
      .filter((item: any) => item.id !== mapId && (current?.version == null || item.version < current.version))
      .sort((left: any, right: any) => (right.version ?? 0) - (left.version ?? 0))[0];
    if (!previous) {
      return {
        updated: event,
        previousMapId: null,
        inheritedSessionIds: [],
        inventory: { inventorySessionIds: [], inventoryCreatedCount: 0 },
        previousMapArchive: { archived: false, code: "NO_PREVIOUS_MAP" as const },
        previousMapPreviewKey: null,
      };
    }
    const references = sessions.filter((session: any) => session.mapId === previous.id).map((session: any) => session.id);
    if (references.length) {
      return {
        updated: event,
        previousMapId: previous.id,
        inheritedSessionIds: [],
        inventory: { inventorySessionIds: [], inventoryCreatedCount: 0 },
        previousMapArchive: { archived: false, code: "MAP_IN_USE" as const, sessionIds: references },
        previousMapPreviewKey: null,
      };
    }
    if (previous.status === "ARQUIVADO") {
      return {
        updated: event,
        previousMapId: previous.id,
        inheritedSessionIds: [],
        inventory: { inventorySessionIds: [], inventoryCreatedCount: 0 },
        previousMapArchive: { archived: true, code: "ARCHIVED" as const },
        previousMapPreviewKey: null,
      };
    }
    return {
      updated: event,
      previousMapId: previous.id,
      inheritedSessionIds: [],
      inventory: { inventorySessionIds: [], inventoryCreatedCount: 0 },
      previousMapArchive: { archived: false, code: "NO_PREVIOUS_MAP" as const },
      previousMapPreviewKey: null,
    };
  }

  async sincronizarInventarioMapa(db: Database, eventId: string, mapId: string, actor: EventoActor, sessionIds?: string[]) {
    const [event] = await db.select().from(eventos).where(eq(eventos.id, eventId));
    const sessions = await db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId));
    const seats = await db.select().from(eventoMapaAssentos).where(eq(eventoMapaAssentos.mapId, mapId));
    const targetSessions = sessionIds
      ? sessions.filter((session: any) => sessionIds.includes(session.id))
      : sessions.filter((session: any) => session.mapId === mapId || (!session.mapId && (!event?.defaultMapId || event.defaultMapId === mapId)));
    let inventoryCreatedCount = 0;

    for (const session of targetSessions) {
      const existing = await db.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.sessionId, session.id));
      const existingSeatIds = new Set(existing.map((item: any) => item.seatId));
      for (const seat of seats) {
        if (existingSeatIds.has(seat.id)) continue;
        const insertQuery = db.insert(eventoInventarioAssentos).values({
          sessionId: session.id,
          seatId: seat.id,
          status: seat.sellable === false ? "BLOQUEADO" : "DISPONIVEL",
          blockedReason: seat.sellable === false ? "MAPA_ASSENTO_NAO_VENDAVEL" : null,
        });
        let inserted = true;
        if (typeof (insertQuery as any).onConflictDoNothing === "function") {
          const conflictQuery = (insertQuery as any).onConflictDoNothing({ target: [eventoInventarioAssentos.sessionId, eventoInventarioAssentos.seatId] });
          inserted = typeof conflictQuery.returning === "function"
            ? (await conflictQuery.returning({ id: eventoInventarioAssentos.id })).length > 0
            : true;
        } else {
          await insertQuery;
        }
        if (inserted) inventoryCreatedCount += 1;
      }
    }

    await this.audit(eventId, actor, mapId, { action: "gerar_inventario", inventorySessionIds: targetSessions.map((session: any) => session.id), inventoryCreatedCount }, db);
    return { inventorySessionIds: targetSessions.map((session: any) => session.id), inventoryCreatedCount };
  }

  async importar(eventId: string, file: MultipartFile, actor: EventoActor, pagina?: number): Promise<MapImportSummary> {
    if (!this.storage) throw new BadRequestException({ code: "STORAGE_UNAVAILABLE", message: "Armazenamento de mapas indisponível" });
    let original: { key: string } | undefined;
    try {
      return await this.transaction(async (db) => {
        const [event] = await this.lockRows<any>(db.select().from(eventos).where(eq(eventos.id, eventId)));
        if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
        if (actor.role !== "master" && event.schoolId !== actor.schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });

        const sessoesQuery = db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId));
        const sessoesOrdenadas = typeof (sessoesQuery as any).orderBy === "function" ? (sessoesQuery as any).orderBy(asc(eventoSessoes.id)) : sessoesQuery;
        const sessoes = await this.lockRows<any>(sessoesOrdenadas);
        const mapasQuery = db.select().from(eventoMapas).where(eq(eventoMapas.eventId, eventId));
        const mapasOrdenados = typeof (mapasQuery as any).orderBy === "function" ? (mapasQuery as any).orderBy(asc(eventoMapas.id)) : mapasQuery;
        const mapas = await this.lockRows<any>(mapasOrdenados);
        const importacoesQuery = db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.eventId, eventId));
        const importacoesOrdenadas = typeof (importacoesQuery as any).orderBy === "function" ? (importacoesQuery as any).orderBy(asc(eventoImportacoesMapa.id)) : importacoesQuery;
        await this.lockRows<any>(importacoesOrdenadas);
        const inventoryQuery = sessoes.length
          ? db.select().from(eventoInventarioAssentos).where(inArray(eventoInventarioAssentos.sessionId, sessoes.map((sessao: any) => sessao.id)))
          : db.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.sessionId, "__nenhuma__"));
        const inventoryOrdenado = typeof (inventoryQuery as any).orderBy === "function" ? (inventoryQuery as any).orderBy(asc(eventoInventarioAssentos.id)) : inventoryQuery;
        await this.lockRows<any>(inventoryOrdenado);
        const tipoTrava = await carregarTrava(db, eventId, new Date(), this.lockRows.bind(this));
        exigirMapaLivre(tipoTrava);

        const plantaGrande = new BadRequestException({ code: "MAP_TOO_LARGE", message: "A planta passa de 10 MB. Envie o PDF exportado do programa de desenho, sem imagens." });
        let buffer: Buffer;
        try {
          buffer = await file.toBuffer();
        } catch (erro) {
          // O multipart corta a leitura no teto e sinaliza com este código.
          if ((erro as { code?: string })?.code === "FST_REQ_FILE_TOO_LARGE") throw plantaGrande;
          throw erro;
        }
        if (buffer.length > MAX_PLANTA_PDF_BYTES) throw plantaGrande;
        if (file.mimetype !== "application/pdf" && buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new BadRequestException({ code: "INVALID_MAP_TYPE", message: "Envie a planta em PDF." });
        const proposta = await this.gerador.gerar(buffer, pagina);
        original = await this.storage!.uploadMapBuffer(buffer, file.filename, "application/pdf", `eventos/${eventId}/mapas/originais`);
        const emUso = new Set<string>([...sessoes.map((sessao: any) => sessao.mapId), event.defaultMapId].filter(Boolean));
        for (const anterior of mapas.filter((item: any) => item.status === "EM_REVISAO" && !emUso.has(item.id))) {
          await db.update(eventoMapas).set({ status: "ARQUIVADO", updatedAt: new Date() }).where(and(eq(eventoMapas.id, anterior.id), eq(eventoMapas.eventId, eventId)));
        }
        const version = Math.max(0, ...mapas.map((item: any) => item.version ?? 0)) + 1;
        const [map] = await db.insert(eventoMapas).values({ eventId, version, originalFileKey: original.key, originalFileName: file.filename, originalMimeType: "application/pdf", status: "EM_REVISAO" }).returning();
        if (!map) throw new BadRequestException({ code: "MAP_IMPORT_FAILED", message: "Não foi possível criar a versão do mapa" });
        const proposalCount = proposta.lugares.length;
        const conflictCount = proposta.pontos.length;
        const [imp] = await db.insert(eventoImportacoesMapa).values({ eventId, mapId: map.id, fileKey: original.key, detector: "pdf-vetorial", detectorVersion: "2", status: "EM_REVISAO", proposta, proposalCount, conflictCount }).returning();
        if (!imp) throw new BadRequestException({ code: "MAP_IMPORT_FAILED", message: "Não foi possível registrar a importação" });
        await this.audit(eventId, actor, map.id, { action: "importar", importId: imp.id, conflicts: conflictCount }, db);
        return { importId: imp.id, mapId: map.id, status: "EM_REVISAO" as const, proposalCount, conflictCount };
      });
    } catch (error) {
      if (original?.key) await this.storage.deleteFileStrict(original.key).catch(() => undefined);
      throw error;
    }
  }

  async listar(eventId: string, actor: EventoActor): Promise<{ versoes: VersaoMapaResumo[]; trava: { tipo: TipoTrava; mensagem: string | null } }> {
    const event = await this.assertEvent(eventId, actor);
    const maps = await this.db.select().from(eventoMapas).where(eq(eventoMapas.eventId, eventId)).orderBy(desc(eventoMapas.version));
    const sessoes = await this.db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId));
    const importacoes = await this.db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.eventId, eventId));
    const mapIds = maps.map((map: any) => map.id);
    const assentos = mapIds.length
      ? await this.db.select().from(eventoMapaAssentos).where(inArray(eventoMapaAssentos.mapId, mapIds))
      : [];
    const propostaPorMapa = new Map(importacoes.map((importacao: any) => [importacao.mapId, importacao.proposta]));
    const sessoesPorMapa = new Map<string, Array<{ id: string; startsAt: Date }>>();
    for (const sessao of sessoes as any[]) {
      if (!sessao.mapId) continue;
      const daVersao = sessoesPorMapa.get(sessao.mapId) ?? [];
      daVersao.push({ id: sessao.id, startsAt: sessao.startsAt });
      sessoesPorMapa.set(sessao.mapId, daVersao);
    }
    const versoes = (maps as any[]).map((map): VersaoMapaResumo => {
      const proposta = propostaPorMapa.get(map.id) as { lugares?: unknown[] } | null | undefined;
      const lugares = map.status === "EM_REVISAO"
        ? (Array.isArray(proposta?.lugares) ? proposta.lugares.length : 0)
        : assentos.filter((assento: any) => assento.mapId === map.id).length;
      return {
        id: map.id,
        version: map.version,
        status: map.status,
        originalFileName: map.originalFileName ?? null,
        createdAt: map.createdAt,
        confirmedAt: map.confirmedAt ?? null,
        atual: map.id === event.defaultMapId,
        lugares,
        sessoes: sessoesPorMapa.get(map.id) ?? [],
        editavel: ["CONFIRMADO", "ARQUIVADO"].includes(map.status) && Boolean(proposta),
      };
    });
    const tipo = await carregarTrava(this.db, eventId, new Date());
    return { versoes, trava: { tipo, mensagem: tipo === "LIVRE" ? null : MENSAGEM_TRAVA[tipo] } };
  }

  async obterOriginal(eventId: string, versionId: string, actor: EventoActor): Promise<{ body: unknown; contentType: string; contentLength?: number }> {
    await this.assertEvent(eventId, actor);
    if (!this.storage) throw new BadRequestException({ code: "STORAGE_UNAVAILABLE", message: "Armazenamento de mapas indisponível" });
    const [map] = await this.db.select().from(eventoMapas).where(and(eq(eventoMapas.id, versionId), eq(eventoMapas.eventId, eventId)));
    if (!map) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });
    // Versões antigas podem ter SVG ou PNG como original; só o PDF é servido ao painel.
    const indisponivel = () => new NotFoundException({ code: "MAP_ORIGINAL_NOT_FOUND", message: "Planta original indisponível." });
    if (map.originalMimeType !== "application/pdf" || !map.originalFileKey) throw indisponivel();
    let arquivo: Awaited<ReturnType<StorageService["getObject"]>>;
    try {
      arquivo = await this.storage.getObject(map.originalFileKey);
    } catch (erro) {
      const e = erro as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) throw indisponivel();
      throw erro;
    }
    return { body: arquivo.Body, contentType: "application/pdf", contentLength: arquivo.ContentLength };
  }

  async revisao(eventId: string, versionId: string, actor: EventoActor): Promise<{ map: any; import: any; proposta: PropostaMapa | null }> {
    await this.assertEvent(eventId, actor);
    const [map] = await this.db.select().from(eventoMapas).where(and(eq(eventoMapas.id, versionId), eq(eventoMapas.eventId, eventId)));
    if (!map) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });
    const imports = await this.db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.mapId, map.id));
    return { map, import: imports[0] ?? null, proposta: (imports[0]?.proposta as PropostaMapa | null | undefined) ?? null };
  }

  private async carregarPropostaEmRevisao(eventId: string, versionId: string, revisaoBase: number, actor: EventoActor) {
    await this.assertEvent(eventId, actor);
    const [map] = await this.db.select().from(eventoMapas).where(and(eq(eventoMapas.id, versionId), eq(eventoMapas.eventId, eventId)));
    if (!map) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });
    if (map.status !== "EM_REVISAO") throw new BadRequestException({ code: "MAP_NOT_IN_REVIEW", message: "Somente mapas em revisão podem ser alterados" });
    const [imp] = await this.db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.mapId, map.id));
    const proposta = (imp?.proposta as PropostaMapa | null | undefined) ?? null;
    if (!imp || !proposta) throw new BadRequestException({ code: "PROPOSTA_INEXISTENTE", message: "Este mapa não tem proposta para conferir." });
    this.exigirRevisao(proposta, revisaoBase);
    return { imp, proposta };
  }

  private exigirRevisao(proposta: PropostaMapa | null | undefined, revisaoBase: number) {
    if (!proposta) throw new BadRequestException({ code: "PROPOSTA_INEXISTENTE", message: "Este mapa não tem proposta para conferir." });
    if (proposta.revisao !== revisaoBase) throw new BadRequestException({ code: "PROPOSTA_DESATUALIZADA", message: "Esta conferência foi alterada em outra aba. Recarregue para continuar." });
  }

  async editarProposta(eventId: string, versionId: string, input: { revisaoBase: number; operacoes: OperacaoProposta[] }, actor: EventoActor): Promise<PropostaMapa> {
    const { imp, proposta } = await this.carregarPropostaEmRevisao(eventId, versionId, input.revisaoBase, actor);
    let nova: PropostaMapa;
    try {
      nova = aplicarOperacoes(proposta, input.operacoes);
    } catch (erro) {
      if (erro instanceof ErroProposta) throw new BadRequestException({ code: erro.code, message: erro.message });
      throw erro;
    }
    await this.transaction(async (db) => {
      const [mapaAtual] = await this.lockRows(db.select().from(eventoMapas).where(and(eq(eventoMapas.id, versionId), eq(eventoMapas.eventId, eventId))));
      if (!mapaAtual || mapaAtual.status !== "EM_REVISAO") throw new BadRequestException({ code: "MAP_NOT_IN_REVIEW", message: "Somente mapas em revisão podem ser alterados" });
      const [importacaoAtual] = await this.lockRows(db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.id, imp.id)));
      this.exigirRevisao(importacaoAtual?.proposta as PropostaMapa | null | undefined, input.revisaoBase);
      await db.update(eventoImportacoesMapa).set({ proposta: nova, updatedAt: new Date() }).where(eq(eventoImportacoesMapa.id, imp.id));
      await this.audit(eventId, actor, versionId, { action: "editar_proposta", revisao: nova.revisao, operacoes: input.operacoes }, db);
    });
    return nova;
  }

  async publicar(eventId: string, versionId: string, input: { revisaoBase: number; motivo?: string }, actor: EventoActor) {
    const motivo = input.motivo?.trim() || undefined;
    return this.transaction(async (db) => {
      const [event] = await this.lockRows(db.select().from(eventos).where(eq(eventos.id, eventId)));
      if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
      if (actor.role !== "master" && event.schoolId !== actor.schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });

      const sessoesQuery = db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId));
      const sessoesOrdenadas = typeof (sessoesQuery as any).orderBy === "function" ? (sessoesQuery as any).orderBy(asc(eventoSessoes.id)) : sessoesQuery;
      const sessoes = await this.lockRows<any>(sessoesOrdenadas);
      const mapasQuery = db.select().from(eventoMapas).where(eq(eventoMapas.eventId, eventId));
      const mapasOrdenados = typeof (mapasQuery as any).orderBy === "function" ? (mapasQuery as any).orderBy(asc(eventoMapas.id)) : mapasQuery;
      const mapas = await this.lockRows<any>(mapasOrdenados);
      const map = mapas.find((item: any) => item.id === versionId);
      if (!map) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });
      if (map.status !== "EM_REVISAO") throw new BadRequestException({ code: "MAP_NOT_IN_REVIEW", message: "Somente mapas em revisão podem ser confirmados" });
      const [importacao] = await this.lockRows(db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.mapId, versionId)));
      const proposta = importacao?.proposta as PropostaMapa | null | undefined;
      this.exigirRevisao(proposta, input.revisaoBase);
      const propostaValidada = proposta as PropostaMapa;
      const pendencias = pendenciasPublicacao(propostaValidada);
      if (pendencias.length) throw new BadRequestException({ code: "PROPOSTA_COM_PENDENCIAS", message: "Ainda há pontos para conferir antes de publicar.", details: { pendencias } });
      const { seats, layout } = propostaParaConfirmacao(propostaValidada);

      const inventoryQuery = sessoes.length
        ? db.select().from(eventoInventarioAssentos).where(inArray(eventoInventarioAssentos.sessionId, sessoes.map((sessao: any) => sessao.id)))
        : db.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.sessionId, "__nenhuma__"));
      const inventoryOrdenado = typeof (inventoryQuery as any).orderBy === "function" ? (inventoryQuery as any).orderBy(asc(eventoInventarioAssentos.id)) : inventoryQuery;
      const inventarioTravado = await this.lockRows<any>(inventoryOrdenado);
      let pedidosTravados: any[] = [];
      const lockTrava = async <T>(query: unknown): Promise<T[]> => {
        const rows = await this.lockRows<T>(query);
        pedidosTravados = rows as any[];
        return rows;
      };
      const tipoTrava = await carregarTrava(db, eventId, new Date(), lockTrava);
      exigirMapaLivre(tipoTrava);

      const gravada = await this.gravarConfirmacao(db, map, { seats, layout, reason: motivo, actor, importRow: importacao });
      await db.update(eventos).set({ defaultMapId: versionId, updatedAt: new Date() }).where(eq(eventos.id, eventId));
      const levado = await levarSessoesParaVersao(db, { eventId, versaoId: versionId, agora: new Date(), lockRows: this.lockRows.bind(this), sessoesTravadas: sessoes, mapaTravado: map, inventarioTravado, pedidosTravados });

      const arquivadas: string[] = [];
      for (const anterior of mapas.filter((item: any) => item.id !== versionId && item.status === "CONFIRMADO")) {
        await db.update(eventoMapas).set({ status: "ARQUIVADO", updatedAt: new Date() }).where(and(eq(eventoMapas.id, anterior.id), eq(eventoMapas.eventId, eventId)));
        arquivadas.push(anterior.id);
      }

      await this.audit(eventId, actor, versionId, { action: "publicar", versaoId: versionId, sessionIds: levado.sessionIds, capacidade: levado.capacidade, arquivadas, motivo: motivo ?? null }, db);
      return { map: gravada.map, sessionIds: levado.sessionIds, capacidade: levado.capacidade, arquivadas };
    });
  }

  async editarVersao(eventId: string, versionId: string, actor: EventoActor): Promise<{ mapId: string }> {
    let copiaKey: string | undefined;
    try {
      const mapId = await this.transaction(async (db) => {
        const [event] = await this.lockRows(db.select().from(eventos).where(eq(eventos.id, eventId)));
        if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
        if (actor.role !== "master" && event.schoolId !== actor.schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });

        const sessoesQuery = db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId));
        const sessoesOrdenadas = typeof (sessoesQuery as any).orderBy === "function" ? (sessoesQuery as any).orderBy(asc(eventoSessoes.id)) : sessoesQuery;
        const sessoes = await this.lockRows<any>(sessoesOrdenadas);

        const mapasQuery = db.select().from(eventoMapas).where(eq(eventoMapas.eventId, eventId));
        const mapasOrdenados = typeof (mapasQuery as any).orderBy === "function" ? (mapasQuery as any).orderBy(asc(eventoMapas.id)) : mapasQuery;
        const mapas = await this.lockRows<any>(mapasOrdenados);
        const origem = mapas.find((mapa: any) => mapa.id === versionId);
        if (!origem) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });

        const importacoesQuery = db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.mapId, versionId));
        const importacoesOrdenadas = typeof (importacoesQuery as any).orderBy === "function" ? (importacoesQuery as any).orderBy(asc(eventoImportacoesMapa.id)) : importacoesQuery;
        const [importacao] = await this.lockRows<any>(importacoesOrdenadas);
        const inventarioQuery = sessoes.length
          ? db.select().from(eventoInventarioAssentos).where(inArray(eventoInventarioAssentos.sessionId, sessoes.map((sessao: any) => sessao.id)))
          : db.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.sessionId, "__nenhuma__"));
        const inventarioOrdenado = typeof (inventarioQuery as any).orderBy === "function" ? (inventarioQuery as any).orderBy(asc(eventoInventarioAssentos.id)) : inventarioQuery;
        await this.lockRows<any>(inventarioOrdenado);

        const tipoTrava = await carregarTrava(db, eventId, new Date(), this.lockRows.bind(this));
        exigirMapaLivre(tipoTrava);
        if (!this.storage) throw new BadRequestException({ code: "STORAGE_UNAVAILABLE", message: "Armazenamento de mapas indisponível" });

        if (!["CONFIRMADO", "ARQUIVADO"].includes(origem.status) || !importacao?.proposta) {
          throw new BadRequestException({ code: "EDICAO_INDISPONIVEL", message: "Esta versão não pode ser editada. Envie a planta em PDF." });
        }
        if (!origem.originalFileKey || origem.originalMimeType !== "application/pdf") {
          throw new BadRequestException({ code: "EDICAO_INDISPONIVEL", message: "Esta versão não pode ser editada. Envie a planta em PDF." });
        }

        const arquivo = await this.storage!.getObject(origem.originalFileKey);
        const corpo = arquivo?.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
        if (!corpo?.transformToByteArray) throw new BadRequestException({ code: "EDICAO_INDISPONIVEL", message: "Esta versão não pode ser editada. Envie a planta em PDF." });
        const buffer = Buffer.from(await corpo.transformToByteArray());
        const copia = await this.storage!.uploadMapBuffer(buffer, origem.originalFileName ?? "planta.pdf", "application/pdf", `eventos/${eventId}/mapas/originais`);
        copiaKey = copia.key;

        for (const mapa of mapas.filter((item: any) => item.id !== versionId && item.status === "EM_REVISAO")) {
          await db.update(eventoMapas).set({ status: "ARQUIVADO", updatedAt: new Date() }).where(and(eq(eventoMapas.id, mapa.id), eq(eventoMapas.eventId, eventId)));
        }

        const versao = Math.max(0, ...mapas.map((mapa: any) => mapa.version ?? 0)) + 1;
        const [novoMapa] = await db.insert(eventoMapas).values({
          eventId,
          version: versao,
          originalFileKey: copia.key,
          originalFileName: origem.originalFileName ?? "planta.pdf",
          originalMimeType: "application/pdf",
          status: "EM_REVISAO",
        }).returning();
        if (!novoMapa) throw new BadRequestException({ code: "MAP_EDIT_FAILED", message: "Não foi possível criar a versão do mapa" });

        const proposta = JSON.parse(JSON.stringify(importacao.proposta)) as PropostaMapa;
        proposta.revisao = 0;
        const [novaImportacao] = await db.insert(eventoImportacoesMapa).values({
          eventId,
          mapId: novoMapa.id,
          fileKey: copia.key,
          detector: "edicao",
          detectorVersion: "2",
          status: "EM_REVISAO",
          proposalCount: proposta.lugares.length,
          conflictCount: proposta.pontos.length,
          proposta,
        }).returning();
        if (!novaImportacao) throw new BadRequestException({ code: "MAP_EDIT_FAILED", message: "Não foi possível registrar a importação da versão" });

        await this.audit(eventId, actor, novoMapa.id, { action: "editar_versao", origemMapId: versionId }, db);
        return novoMapa.id as string;
      });
      return { mapId };
    } catch (error) {
      if (copiaKey && this.storage) await this.storage.deleteFileStrict(copiaKey).catch(() => undefined);
      throw error;
    }
  }

  async excluirVersao(eventId: string, versionId: string, actor: EventoActor): Promise<{ excluida: true; sessionIds: string[] }> {
    const resultado = await this.transaction(async (db) => {
      const [event] = await this.lockRows(db.select().from(eventos).where(eq(eventos.id, eventId)));
      if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
      if (actor.role !== "master" && event.schoolId !== actor.schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });
      if (!event.defaultMapId || event.defaultMapId === versionId) {
        throw new BadRequestException({ code: "MAPA_ATUAL", message: "A versão atual não pode ser excluída." });
      }

      const sessoesQuery = db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId));
      const sessoesOrdenadas = typeof (sessoesQuery as any).orderBy === "function" ? (sessoesQuery as any).orderBy(asc(eventoSessoes.id)) : sessoesQuery;
      const sessoes = await this.lockRows<any>(sessoesOrdenadas);

      const mapasQuery = db.select().from(eventoMapas).where(eq(eventoMapas.eventId, eventId));
      const mapasOrdenados = typeof (mapasQuery as any).orderBy === "function" ? (mapasQuery as any).orderBy(asc(eventoMapas.id)) : mapasQuery;
      const mapas = await this.lockRows<any>(mapasOrdenados);
      const mapaAtual = mapas.find((item: any) => item.id === event.defaultMapId);
      if (!mapaAtual) throw new BadRequestException({ code: "MAPA_ATUAL", message: "A versão atual não pode ser excluída." });
      const mapa = mapas.find((item: any) => item.id === versionId);
      if (!mapa) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });

      const importacoesQuery = db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.mapId, versionId));
      const importacoesOrdenadas = typeof (importacoesQuery as any).orderBy === "function" ? (importacoesQuery as any).orderBy(asc(eventoImportacoesMapa.id)) : importacoesQuery;
      await this.lockRows<any>(importacoesOrdenadas);

      const inventarioQuery = sessoes.length
        ? db.select().from(eventoInventarioAssentos).where(inArray(eventoInventarioAssentos.sessionId, sessoes.map((sessao: any) => sessao.id)))
        : db.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.sessionId, "__nenhuma__"));
      const inventarioOrdenado = typeof (inventarioQuery as any).orderBy === "function" ? (inventarioQuery as any).orderBy(asc(eventoInventarioAssentos.id)) : inventarioQuery;
      const inventarioTravado = await this.lockRows<any>(inventarioOrdenado);

      let pedidosTravados: any[] = [];
      const tipoTrava = await carregarTrava(db, eventId, new Date(), async <T>(query: unknown) => {
        const linhas = await this.lockRows<T>(query);
        pedidosTravados = linhas as any[];
        return linhas;
      });
      exigirMapaLivre(tipoTrava);

      const sessionIds = sessoes.filter((sessao: any) => sessao.mapId === versionId).map((sessao: any) => sessao.id).sort();
      if (sessionIds.length) {
        await levarSessoesParaVersao(db, {
          eventId,
          versaoId: event.defaultMapId,
          agora: new Date(),
          sessionIds,
          lockRows: this.lockRows.bind(this),
          sessoesTravadas: sessoes.filter((sessao: any) => sessionIds.includes(sessao.id)),
          mapaTravado: mapaAtual,
          inventarioTravado: inventarioTravado.filter((linha: any) => sessionIds.includes(linha.sessionId)),
          pedidosTravados: pedidosTravados.filter((pedido: any) => sessionIds.includes(pedido.sessionId)),
        });
      }

      await db.delete(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.mapId, versionId));
      await db.delete(eventoMapas).where(and(eq(eventoMapas.id, versionId), eq(eventoMapas.eventId, eventId)));
      await this.audit(eventId, actor, versionId, { action: "excluir_versao", sessionIds }, db);
      return { sessionIds, storageKeys: [mapa.originalFileKey, mapa.previewFileKey].filter((key): key is string => typeof key === "string" && key.length > 0) };
    });

    if (this.storage) {
      const remover = typeof (this.storage as any).deleteFile === "function"
        ? (this.storage as any).deleteFile.bind(this.storage)
        : (this.storage as any).deleteFileStrict?.bind(this.storage);
      if (remover) {
        for (const key of [...new Set(resultado.storageKeys)]) {
          try {
            await remover(key);
          } catch (error) {
            const e = error as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
            const ausente = e?.name === "NoSuchKey" || e?.code === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
            if (!ausente) this.logger.error(JSON.stringify({ operation: "excluir_versao", phase: "delete_storage", eventId, versionId, key, error: error instanceof Error ? error.message : String(error) }));
          }
        }
      }
    }
    return { excluida: true, sessionIds: resultado.sessionIds };
  }

  private async gravarConfirmacao(
    db: Database,
    map: any,
    entrada: { seats: ConfirmMapInput["seats"]; layout?: LayoutMapa; reason?: string; actor: EventoActor; importRow?: any },
  ) {
    if (!entrada.seats.length) throw new BadRequestException({ code: "MAP_EMPTY", message: "O mapa precisa de pelo menos um assento" });
    const unique = new Set(entrada.seats.map((seat) => `${seat.rowLabel}:${seat.seatNumber}`));
    if (unique.size !== entrada.seats.length) throw new BadRequestException({ code: "MAP_DUPLICATE_SEAT", message: "Existem assentos duplicados" });
    if (typeof (db as any).delete === "function") await db.delete(eventoMapaAssentos).where(eq(eventoMapaAssentos.mapId, map.id));
    for (const seat of entrada.seats) await db.insert(eventoMapaAssentos).values({ mapId: map.id, rowLabel: seat.rowLabel, seatNumber: seat.seatNumber, x: seat.x, y: seat.y, width: seat.width ?? 1, height: seat.height ?? 1, category: seat.category ?? null, accessible: seat.accessible ?? false, sellable: seat.sellable ?? true, ...(seat.metadata ? { metadata: seat.metadata } : {}) });
    const [next] = await db.update(eventoMapas).set({ status: "CONFIRMADO", ...(entrada.layout ? { layout: entrada.layout } : {}), confirmedAt: new Date(), confirmedBy: entrada.actor.userId, updatedAt: new Date() }).where(eq(eventoMapas.id, map.id)).returning();
    const importRow = entrada.importRow;
    if (importRow) await db.update(eventoImportacoesMapa).set({ status: "CONFIRMADA", reviewedBy: entrada.actor.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(eventoImportacoesMapa.id, importRow.id));
    return { map: next ?? map, importRow };
  }

  async arquivar(eventId: string, versionId: string, actor: EventoActor) {
    const result = await this.transaction(async (db) => {
      const eventQuery = db.select().from(eventos).where(eq(eventos.id, eventId));
      const [event] = await (typeof (eventQuery as any).for === "function" ? (eventQuery as any).for("update") : eventQuery);
      if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
      if (actor.role !== "master" && event.schoolId !== actor.schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });
      if (event.defaultMapId === versionId) throw new BadRequestException({ code: "MAP_IN_USE", message: "Mapa está em uso pelo evento" });
      const referencesQuery = db.select({ mapId: eventoSessoes.mapId }).from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId));
      const references = await (typeof (referencesQuery as any).for === "function" ? (referencesQuery as any).for("update") : referencesQuery);
      if (references.some((row: any) => row.mapId === versionId)) throw new BadRequestException({ code: "MAP_IN_USE", message: "Mapa está em uso por uma sessão" });
      const mapQuery = db.select().from(eventoMapas).where(and(eq(eventoMapas.id, versionId), eq(eventoMapas.eventId, eventId)));
      const [current] = await (typeof (mapQuery as any).for === "function" ? (mapQuery as any).for("update") : mapQuery);
      if (!current) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });
      if (current.status !== "EM_REVISAO" && current.status !== "CONFIRMADO") throw new BadRequestException({ code: "MAP_INVALID_TRANSITION", message: "Mapa já arquivado ou em estado inválido" });
      const [next] = await db.update(eventoMapas).set({ status: "ARQUIVADO", updatedAt: new Date() }).where(and(eq(eventoMapas.id, versionId), eq(eventoMapas.eventId, eventId))).returning();
      if (!next) return undefined;
      await this.audit(eventId, actor, versionId, { action: "arquivar" }, db);
      return { map: next, previewFileKey: current.previewFileKey };
    });
    if (!result) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });
    if (result.previewFileKey && this.storage) await this.storage.deleteFile(result.previewFileKey).catch(() => undefined);
    return result.map;
  }

  /** Iguala a capacidade das sessões ao número de lugares vendáveis do mapa. Devolve o valor aplicado ou null se não havia sessão. */
  private async ajustarCapacidade(db: Database, sessionIds: string[], mapSeats: Array<{ sellable: boolean | null }>): Promise<number | null> {
    if (!sessionIds.length) return null;
    const capacity = mapSeats.filter((seat) => seat.sellable !== false).length;
    await db.update(eventoSessoes).set({ capacity, updatedAt: new Date() }).where(inArray(eventoSessoes.id, sessionIds));
    return capacity;
  }

  async migrarSessoesEExcluir(eventId: string, mapId: string, input: { targetMapId: string; sessionIds?: string[] }, actor: EventoActor): Promise<MapMigrationResult> {
    const result = await this.transaction(async (db) => {
      const eventQuery = db.select().from(eventos).where(eq(eventos.id, eventId));
      const [event] = await this.lockRows(eventQuery);
      if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
      if (actor.role !== "master" && event.schoolId !== actor.schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });

      const sessionsQuery = db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId));
      const orderedSessionsQuery = typeof (sessionsQuery as any).orderBy === "function" ? (sessionsQuery as any).orderBy(asc(eventoSessoes.id)) : sessionsQuery;
      const sessions = await this.lockRows(orderedSessionsQuery);
      if (mapId === input.targetMapId) throw new BadRequestException({ code: "SAME_MAP", message: "O mapa de origem e o mapa de destino devem ser diferentes" });
      const auditQuery = db.select().from(eventoAuditorias).where(and(eq(eventoAuditorias.eventId, eventId), eq(eventoAuditorias.resourceType, "mapa"), eq(eventoAuditorias.resourceId, mapId)));
      const priorAudits = await auditQuery;
      const prior = (priorAudits ?? []).find((audit: any) => audit?.metadata?.action === "migrar_sessoes_e_excluir" && audit.metadata.targetMapId === input.targetMapId);
      if (prior?.metadata) {
        const metadata = prior.metadata as any;
        return {
          oldMapId: mapId,
          targetMapId: input.targetMapId,
          migratedSessionIds: Array.isArray(metadata.migratedSessionIds) ? metadata.migratedSessionIds : [],
          inheritedSessionIds: Array.isArray(metadata.inheritedSessionIds) ? metadata.inheritedSessionIds : [],
          inventoryCreatedCount: typeof metadata.inventoryCreatedCount === "number" ? metadata.inventoryCreatedCount : 0,
          deletedMap: { deleted: true, code: "DELETED" as const },
          storageKeys: Array.isArray(metadata.storageKeys) ? metadata.storageKeys.filter((key: unknown): key is string => typeof key === "string") : [],
        };
      }

      const mapsQuery = db.select().from(eventoMapas).where(inArray(eventoMapas.id, [mapId, input.targetMapId].sort()));
      const orderedMapsQuery = typeof (mapsQuery as any).orderBy === "function" ? (mapsQuery as any).orderBy(asc(eventoMapas.id)) : mapsQuery;
      const maps = await this.lockRows(orderedMapsQuery);
      const oldMap = maps.find((map: any) => map.id === mapId);
      const targetMap = maps.find((map: any) => map.id === input.targetMapId);
      if (!oldMap) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Mapa não encontrado" });
      if (oldMap.eventId !== eventId || (targetMap && targetMap.eventId !== eventId)) throw new BadRequestException({ code: "MAP_EVENT_MISMATCH", message: "O mapa informado pertence a outro evento" });
      if (!targetMap) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Mapa não encontrado" });
      if (targetMap.status !== "CONFIRMADO") throw new BadRequestException({ code: "MAP_NOT_CONFIRMED", message: "Somente mapas confirmados podem ser usados como destino" });

      const allSeats = await db.select().from(eventoMapaAssentos).where(inArray(eventoMapaAssentos.mapId, [mapId, input.targetMapId]));
      const oldSeats = allSeats.filter((seat: any) => seat.mapId === mapId);
      const targetSeats = allSeats.filter((seat: any) => seat.mapId === input.targetMapId);
      if (!targetSeats.length) throw new BadRequestException({ code: "MAP_EMPTY", message: "O mapa de destino precisa de pelo menos um assento" });

      const oldSeatIds = new Set(oldSeats.map((seat: any) => seat.id));
      const inventoryQuery = db.select().from(eventoInventarioAssentos).where(oldSeatIds.size ? inArray(eventoInventarioAssentos.seatId, [...oldSeatIds]) : eq(eventoInventarioAssentos.sessionId, "__nenhuma__"));
      const orderedInventoryQuery = typeof (inventoryQuery as any).orderBy === "function" ? (inventoryQuery as any).orderBy(asc(eventoInventarioAssentos.id)) : inventoryQuery;
      const inventoryRows = await this.lockRows(orderedInventoryQuery);
      const explicitSessions = sessions.filter((session: any) => session.mapId === mapId);
      const inventorySessions = sessions.filter((session: any) => inventoryRows.some((inventory: any) => inventory.sessionId === session.id && oldSeatIds.has(inventory.seatId)));
      const inheritedSessions = inventorySessions.filter((session: any) => session.mapId == null);
      const impacted = [...new Map([...explicitSessions, ...inventorySessions].map((session: any) => [session.id, session])).values()];
      const migratedSessionIds = impacted.map((session: any) => session.id);
      const inheritedSessionIds = inheritedSessions.map((session: any) => session.id);
      if (input.sessionIds !== undefined) {
        const requested = [...new Set(input.sessionIds)];
        if (requested.length !== migratedSessionIds.length || requested.some((sessionId) => !migratedSessionIds.includes(sessionId))) {
          throw new BadRequestException({ code: "SESSION_SELECTION_INCOMPLETE", message: "A seleção de sessões não contém todas as sessões impactadas" });
        }
      }

      const sessionIds = new Set(migratedSessionIds);
      const allInventoryQuery = db.select().from(eventoInventarioAssentos).where(
        migratedSessionIds.length
          ? inArray(eventoInventarioAssentos.sessionId, migratedSessionIds)
          : eq(eventoInventarioAssentos.sessionId, "__nenhuma__"),
      );
      const orderedAllInventoryQuery = typeof (allInventoryQuery as any).orderBy === "function"
        ? (allInventoryQuery as any).orderBy(asc(eventoInventarioAssentos.id))
        : allInventoryQuery;
      const allInventoryRows = await this.lockRows(orderedAllInventoryQuery);
      const impactedInventoryIds = allInventoryRows
        .filter((inventory: any) => sessionIds.has(inventory.sessionId))
        .map((inventory: any) => inventory.id);
      const lockDependencias = async (table: any, predicate: any, idColumn: any) => {
        const query = db.select().from(table).where(predicate);
        const ordered = typeof (query as any).orderBy === "function" ? (query as any).orderBy(asc(idColumn)) : query;
        return this.lockRows(ordered);
      };
      const pedidos = migratedSessionIds.length
        ? await lockDependencias(eventoPedidos, inArray(eventoPedidos.sessionId, migratedSessionIds), eventoPedidos.id)
        : [];
      const reservas = impactedInventoryIds.length
        ? await lockDependencias(eventoReservas, inArray(eventoReservas.inventorySeatId, impactedInventoryIds), eventoReservas.id)
        : [];
      const itensPedido = impactedInventoryIds.length
        ? await lockDependencias(eventoItensPedido, inArray(eventoItensPedido.inventorySeatId, impactedInventoryIds), eventoItensPedido.id)
        : [];
      const transferencias = impactedInventoryIds.length
        ? await lockDependencias(eventoTransferencias, or(inArray(eventoTransferencias.fromSeatId, impactedInventoryIds), inArray(eventoTransferencias.toSeatId, impactedInventoryIds)), eventoTransferencias.id)
        : [];
      const ingressos = migratedSessionIds.length
        ? await lockDependencias(eventoIngressos, inArray(eventoIngressos.sessionId, migratedSessionIds), eventoIngressos.id)
        : [];
      const checkins = migratedSessionIds.length
        ? await lockDependencias(eventoCheckins, inArray(eventoCheckins.sessionId, migratedSessionIds), eventoCheckins.id)
        : [];
      const operacoes = migratedSessionIds.length
        ? await lockDependencias(eventoOperacoesAdministrativas, inArray(eventoOperacoesAdministrativas.sessionId, migratedSessionIds), eventoOperacoesAdministrativas.id)
        : [];
      const dependencyRows = [
        ...pedidos.filter((dependency: any) => dependency.sessionId === undefined || sessionIds.has(dependency.sessionId)),
        ...itensPedido.filter((dependency: any) => dependency.inventorySeatId === undefined || impactedInventoryIds.includes(dependency.inventorySeatId)),
        ...reservas.filter((dependency: any) => dependency.inventorySeatId === undefined || impactedInventoryIds.includes(dependency.inventorySeatId)),
        ...transferencias.filter((dependency: any) => dependency.fromSeatId === undefined || impactedInventoryIds.includes(dependency.fromSeatId) || dependency.toSeatId === undefined || impactedInventoryIds.includes(dependency.toSeatId)),
        ...ingressos.filter((dependency: any) => dependency.sessionId === undefined || sessionIds.has(dependency.sessionId)),
        ...checkins.filter((dependency: any) => dependency.sessionId === undefined || sessionIds.has(dependency.sessionId)),
        ...operacoes.filter((dependency: any) => dependency.sessionId === undefined || sessionIds.has(dependency.sessionId) || dependency.inventorySeatId === undefined || impactedInventoryIds.includes(dependency.inventorySeatId)),
      ];
      if (dependencyRows.length) throw new BadRequestException({ code: "SESSION_HAS_DEPENDENCIES", message: "A sessão possui dados operacionais e não pode ser migrada", sessionIds: migratedSessionIds });

      const now = new Date();
      for (const session of explicitSessions) await db.update(eventoSessoes).set({ mapId: input.targetMapId, updatedAt: now }).where(eq(eventoSessoes.id, session.id));
      if (event.defaultMapId === mapId) await db.update(eventos).set({ defaultMapId: input.targetMapId, updatedAt: now }).where(eq(eventos.id, eventId));
      if (migratedSessionIds.length) {
        try {
          await db.delete(eventoInventarioAssentos).where(inArray(eventoInventarioAssentos.sessionId, migratedSessionIds));
        } catch (error) {
          this.logger.error(JSON.stringify({ operation: "migrar_sessoes_e_excluir", phase: "delete_inventory", eventId, mapId, error: error instanceof Error ? error.message : String(error) }));
          throw new BadRequestException({ code: "MAP_DELETE_BLOCKED", message: "O inventário antigo ainda possui referências e não pode ser removido" });
        }
      }
      let inventoryCreatedCount = 0;
      for (const sessionId of migratedSessionIds) {
        for (const seat of targetSeats) {
          await db.insert(eventoInventarioAssentos).values({ sessionId, seatId: seat.id, status: seat.sellable === false ? "BLOQUEADO" : "DISPONIVEL", blockedReason: seat.sellable === false ? "MAPA_ASSENTO_NAO_VENDAVEL" : null });
          inventoryCreatedCount += 1;
        }
      }
      const capacity = await this.ajustarCapacidade(db, migratedSessionIds, targetSeats);
      const storageKeys = [...new Set([oldMap.originalFileKey, oldMap.previewFileKey].filter((key): key is string => typeof key === "string" && key.length > 0))];
      const metadata = { action: "migrar_sessoes_e_excluir", oldMapId: mapId, targetMapId: input.targetMapId, migratedSessionIds, inheritedSessionIds, inventoryCreatedCount, capacity, storageKeys, reason: "migração segura de sessões" };
      await this.audit(eventId, actor, mapId, metadata, db);
      try {
        await db.delete(eventoMapas).where(and(eq(eventoMapas.id, mapId), eq(eventoMapas.eventId, eventId)));
      } catch (error) {
        this.logger.error(JSON.stringify({ operation: "migrar_sessoes_e_excluir", phase: "delete_map", eventId, mapId, error: error instanceof Error ? error.message : String(error) }));
        throw new BadRequestException({ code: "MAP_DELETE_BLOCKED", message: "O mapa antigo ainda possui referências e não pode ser excluído" });
      }
      return { oldMapId: mapId, targetMapId: input.targetMapId, migratedSessionIds, inheritedSessionIds, inventoryCreatedCount, deletedMap: { deleted: true, code: "DELETED" as const }, storageKeys };
    });
    if (result.storageKeys && this.storage) {
      await Promise.all([...new Set<string>(result.storageKeys)].map(async (key) => {
        const storage = this.storage as any;
        const remover = typeof storage.deleteFile === "function" ? storage.deleteFile.bind(storage) : storage.deleteFileStrict?.bind(storage);
        if (remover) {
          try {
            await remover(key);
          } catch (error) {
            this.logger.error(JSON.stringify({ operation: "migrar_sessoes_e_excluir", phase: "delete_storage", eventId, mapId, key, error: error instanceof Error ? error.message : String(error) }));
          }
        }
      }));
    }
    const { storageKeys: _storageKeys, ...response } = result;
    return response as MapMigrationResult;
  }

  async substituirMapaPadrao(eventId: string, mapId: string, actor: EventoActor): Promise<MapReplacementResult> {
    const result = await this.transaction(async (db) => {
      const now = new Date();
      const [event] = await this.lockRows(db.select().from(eventos).where(eq(eventos.id, eventId)));
      if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
      if (actor.role !== "master" && event.schoolId !== actor.schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });
      const sessions = await this.lockRows(db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId)));
      const [map] = await this.lockRows(db.select().from(eventoMapas).where(eq(eventoMapas.id, mapId)));
      if (!map) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Mapa não encontrado" });
      if (map.eventId !== eventId) throw new BadRequestException({ code: "MAP_EVENT_MISMATCH", message: "O mapa informado pertence a outro evento" });
      if (map.status !== "CONFIRMADO") throw new BadRequestException({ code: "MAP_NOT_CONFIRMED", message: "Somente mapas confirmados podem ser associados" });
      const mapSeats = await db.select().from(eventoMapaAssentos).where(eq(eventoMapaAssentos.mapId, mapId));
      if (!mapSeats.length) throw new BadRequestException({ code: "MAP_EMPTY", message: "O mapa precisa de pelo menos um assento" });
      if (event.defaultMapId === mapId) return (await this.recuperarResultadoIdempotente(db, event, mapId, sessions)) ?? { updated: event, previousMapId: null, inheritedSessionIds: [], inventory: { inventorySessionIds: [], inventoryCreatedCount: 0 }, previousMapArchive: { archived: false, code: "NO_PREVIOUS_MAP" as const }, previousMapPreviewKey: null };
      const inherited = sessions.filter((session: any) => session.mapId == null);
      const previousMapId = event.defaultMapId ?? null;
      const [updated] = await db.update(eventos).set({ defaultMapId: mapId, updatedAt: now }).where(eq(eventos.id, eventId)).returning();
      if (!updated) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
      if (previousMapId) {
        for (const session of inherited) {
          await db.update(eventoInventarioAssentos).set({ status: "BLOQUEADO", blockedReason: "MAPA_PADRAO_ALTERADO", updatedAt: now }).where(and(eq(eventoInventarioAssentos.sessionId, session.id), inArray(eventoInventarioAssentos.status, ["DISPONIVEL", "LIBERADO"])));
        }
      }
      const inventory = await this.sincronizarInventarioMapa(db, eventId, mapId, actor, inherited.map((session: any) => session.id));
      const capacity = await this.ajustarCapacidade(db, inherited.map((session: any) => session.id), mapSeats);
      let previousMapArchive: MapReplacementResult["previousMapArchive"] = { archived: false, code: "NO_PREVIOUS_MAP" };
      if (previousMapId) {
        const previousMapQuery = db.select().from(eventoMapas).where(eq(eventoMapas.id, previousMapId));
        const [previousMap] = await this.lockRows(previousMapQuery);
        const previousMapSeatsRows = previousMap
          ? await db.select().from(eventoMapaAssentos).where(eq(eventoMapaAssentos.mapId, previousMapId))
          : [];
        const previousMapSeats = previousMapSeatsRows.filter((seat: any) => seat.mapId === previousMapId);
        const previousSeatIds = new Set(previousMapSeats.map((seat: any) => seat.id));
        const previousInventoryQuery = previousSeatIds.size
          ? db.select().from(eventoInventarioAssentos).where(inArray(eventoInventarioAssentos.seatId, [...previousSeatIds]))
          : null;
        const previousInventory = previousInventoryQuery ? await this.lockRows(previousInventoryQuery) : [];
        const inventorySessionIds = previousInventory.filter((inventoryRow: any) => previousSeatIds.has(inventoryRow.seatId)).map((inventoryRow: any) => inventoryRow.sessionId);
        const references = [...new Set([
          ...sessions.filter((session: any) => session.mapId === previousMapId).map((session: any) => session.id),
          ...inventorySessionIds,
        ])];
        if (references.length) {
          previousMapArchive = { archived: false, code: "MAP_IN_USE", sessionIds: references };
        } else {
          const [archived] = await db.update(eventoMapas).set({ status: "ARQUIVADO", updatedAt: now }).where(and(eq(eventoMapas.id, previousMapId), eq(eventoMapas.eventId, eventId))).returning();
          if (archived) previousMapArchive = { archived: true, code: "ARCHIVED" };
        }
      }
      await this.audit(eventId, actor, eventId, { action: "substituir_mapa_padrao", previousMapId, nextMapId: mapId, inheritedSessionIds: inherited.map((session: any) => session.id), inventorySessionIds: inventory.inventorySessionIds, inventoryCreatedCount: inventory.inventoryCreatedCount, capacity, previousMapArchive }, db);
      return { updated, previousMapId, inheritedSessionIds: inherited.map((session: any) => session.id), inventory, previousMapArchive, previousMapPreviewKey: previousMapId ? (await db.select().from(eventoMapas).where(eq(eventoMapas.id, previousMapId)))[0]?.previewFileKey : null };
    });
    if (result.previousMapArchive.archived && result.previousMapPreviewKey && this.storage) await this.storage.deleteFile(result.previousMapPreviewKey).catch(() => undefined);
    return { updated: result.updated, previousMapId: result.previousMapId, inheritedSessionIds: result.inheritedSessionIds, inventorySessionIds: result.inventory.inventorySessionIds, inventoryCreatedCount: result.inventory.inventoryCreatedCount, previousMapArchive: result.previousMapArchive };
  }
}
