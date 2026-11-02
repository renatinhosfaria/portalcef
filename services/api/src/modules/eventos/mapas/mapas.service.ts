import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { and, desc, eq, inArray, eventoAuditorias, eventoCheckins, eventoDeteccoesMapa, eventoImportacoesMapa, eventoIngressos, eventoInventarioAssentos, eventoMapaAssentos, eventoMapas, eventoOperacoesAdministrativas, eventoPedidos, eventoReservas, eventoSessoes, eventos, type Database } from "@essencia/db";
import type { MultipartFile } from "@fastify/multipart";
import type { EventoActor } from "@essencia/shared/types";
import { DatabaseService } from "../../../common/database/database.service";
import { StorageService } from "../../../common/storage/storage.service";
import { MapDetector, type MapDetectionResult } from "./map-detector";
import { sanitizeSvg } from "./map-sanitizer";

export interface ConfirmMapInput { seats: Array<{ id?: string; rowLabel: string; seatNumber: string; x: number; y: number; width?: number; height?: number; category?: string | null; accessible?: boolean; sellable?: boolean }>; reason?: string; }
export interface MapImportSummary { importId: string; mapId: string; status: string; proposalCount: number; conflictCount: number; detection: MapDetectionResult; }
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
  constructor(private readonly database: DatabaseService, @Optional() @Inject(StorageService) private readonly storage: StorageService | undefined, private readonly detector: MapDetector) {}
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

  async importar(eventId: string, file: MultipartFile, actor: EventoActor): Promise<MapImportSummary> {
    await this.assertEvent(eventId, actor);
    if (!this.storage) throw new BadRequestException({ code: "STORAGE_UNAVAILABLE", message: "Armazenamento de mapas indisponível" });
    const buffer = await file.toBuffer();
    const mimeType = file.mimetype === "image/svg+xml" ? "image/svg+xml" : file.mimetype;
    let original: { key: string } | undefined;
    let preview: { key: string } | undefined;
    try {
      original = await this.storage.uploadMapBuffer(buffer, file.filename, mimeType, `eventos/${eventId}/mapas/originais`);
      const detectionBuffer = mimeType === "image/svg+xml" ? sanitizeSvg(buffer) : buffer;
      if (mimeType === "image/svg+xml") preview = await this.storage.uploadMapBuffer(detectionBuffer, `preview-${file.filename}`, mimeType, `eventos/${eventId}/mapas/previews`);
      const detection = await this.detector.detect({ buffer: detectionBuffer, mimeType });
      const result = await this.transaction(async (db) => {
        const maps = await db.select().from(eventoMapas).where(eq(eventoMapas.eventId, eventId));
        const version = Math.max(0, ...maps.map((item: any) => item.version ?? 0)) + 1;
        const [map] = await db.insert(eventoMapas).values({ eventId, version, originalFileKey: original!.key, originalFileName: file.filename, originalMimeType: mimeType, previewFileKey: preview?.key ?? null, status: "EM_REVISAO" }).returning();
        if (!map) throw new BadRequestException({ code: "MAP_IMPORT_FAILED", message: "Não foi possível criar a versão do mapa" });
        const [imp] = await db.insert(eventoImportacoesMapa).values({ eventId, mapId: map.id, fileKey: original!.key, detector: detection.detector, detectorVersion: "1", status: "EM_REVISAO", proposalCount: detection.seats.length, conflictCount: detection.conflicts.length }).returning();
        if (!imp) throw new BadRequestException({ code: "MAP_IMPORT_FAILED", message: "Não foi possível registrar a importação" });
        for (const seat of detection.seats) await db.insert(eventoDeteccoesMapa).values({ importId: imp.id, detector: detection.detector, confidence: seat.confidence, proposedRowLabel: seat.rowLabel || null, proposedSeatNumber: seat.seatNumber, proposedX: seat.x, proposedY: seat.y, proposedCategory: seat.category ?? null, status: "PENDENTE", conflictReason: seat.conflict ?? null });
        await this.audit(eventId, actor, map.id, { action: "importar", importId: imp.id, conflicts: detection.conflicts.length }, db);
        return { importId: imp.id, mapId: map.id, status: "EM_REVISAO", proposalCount: detection.seats.length, conflictCount: detection.conflicts.length, detection };
      });
      return result;
    } catch (error) {
      if (original?.key) await this.storage.deleteFileStrict(original.key).catch(() => undefined);
      if (preview?.key) await this.storage.deleteFileStrict(preview.key).catch(() => undefined);
      throw error;
    }
  }

  async revisao(eventId: string, versionId: string, actor: EventoActor) {
    await this.assertEvent(eventId, actor);
    const [map] = await this.db.select().from(eventoMapas).where(and(eq(eventoMapas.id, versionId), eq(eventoMapas.eventId, eventId)));
    if (!map) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });
    const imports = await this.db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.mapId, map.id));
    const detections = imports.length ? await this.db.select().from(eventoDeteccoesMapa).where(eq(eventoDeteccoesMapa.importId, imports[0].id)) : [];
    return { map, import: imports[0] ?? null, detections };
  }

  async atualizarDeteccoes(eventId: string, versionId: string, corrections: ConfirmMapInput, actor: EventoActor) {
    await this.assertEvent(eventId, actor);
    const [map] = await this.db.select().from(eventoMapas).where(and(eq(eventoMapas.id, versionId), eq(eventoMapas.eventId, eventId)));
    if (!map) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });
    if (map.status !== "EM_REVISAO") throw new BadRequestException({ code: "MAP_NOT_IN_REVIEW", message: "Somente mapas em revisão podem ser corrigidos" });
    if (!corrections.reason?.trim()) throw new BadRequestException({ code: "REASON_REQUIRED", message: "Informe o motivo da correção" });
    const [imp] = await this.db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.mapId, map.id));
    if (!imp) throw new BadRequestException({ code: "MAP_IMPORT_NOT_FOUND", message: "Importação não encontrada" });
    await this.transaction(async (db) => {
      for (const seat of corrections.seats) {
        if (seat.id) await db.update(eventoDeteccoesMapa).set({ proposedRowLabel: seat.rowLabel, proposedSeatNumber: seat.seatNumber, proposedX: seat.x, proposedY: seat.y, proposedCategory: seat.category ?? null, reviewedBy: actor.userId, reviewedAt: new Date(), status: "CORRIGIDA", conflictReason: null }).where(and(eq(eventoDeteccoesMapa.id, seat.id), eq(eventoDeteccoesMapa.importId, imp.id)));
        else await db.insert(eventoDeteccoesMapa).values({ importId: imp.id, detector: "human-review", confidence: 100, proposedRowLabel: seat.rowLabel, proposedSeatNumber: seat.seatNumber, proposedX: seat.x, proposedY: seat.y, proposedCategory: seat.category ?? null, status: "CORRIGIDA", reviewedBy: actor.userId, reviewedAt: new Date() });
      }
      await this.audit(eventId, actor, versionId, { action: "corrigir_deteccoes", reason: corrections.reason, count: corrections.seats.length }, db);
    });
    return this.revisao(eventId, versionId, actor);
  }

  async confirmar(eventId: string, versionId: string, corrections: ConfirmMapInput, actor: EventoActor) {
    await this.assertEvent(eventId, actor);
    const [map] = await this.db.select().from(eventoMapas).where(and(eq(eventoMapas.id, versionId), eq(eventoMapas.eventId, eventId)));
    if (!map) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Versão não encontrada" });
    if (map.status !== "EM_REVISAO") throw new BadRequestException({ code: "MAP_NOT_IN_REVIEW", message: "Somente mapas em revisão podem ser confirmados" });
    if (!corrections.seats.length) throw new BadRequestException({ code: "MAP_EMPTY", message: "O mapa precisa de pelo menos um assento" });
    const unique = new Set(corrections.seats.map((seat) => `${seat.rowLabel}:${seat.seatNumber}`));
    if (unique.size !== corrections.seats.length) throw new BadRequestException({ code: "MAP_DUPLICATE_SEAT", message: "Existem assentos duplicados" });
    const { confirmed, imp, inventory } = await this.transaction(async (db) => {
      const [event] = await this.lockRows(db.select().from(eventos).where(eq(eventos.id, eventId)));
      if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
      if (typeof (db as any).delete === "function") await db.delete(eventoMapaAssentos).where(eq(eventoMapaAssentos.mapId, map.id));
      for (const seat of corrections.seats) await db.insert(eventoMapaAssentos).values({ mapId: map.id, rowLabel: seat.rowLabel, seatNumber: seat.seatNumber, x: seat.x, y: seat.y, width: seat.width ?? 1, height: seat.height ?? 1, category: seat.category ?? null, accessible: seat.accessible ?? false, sellable: seat.sellable ?? true });
      const [next] = await db.update(eventoMapas).set({ status: "CONFIRMADO", confirmedAt: new Date(), confirmedBy: actor.userId, updatedAt: new Date() }).where(eq(eventoMapas.id, map.id)).returning();
      const [importRow] = await db.select().from(eventoImportacoesMapa).where(eq(eventoImportacoesMapa.mapId, map.id));
      if (importRow) await db.update(eventoImportacoesMapa).set({ status: "CONFIRMADA", reviewedBy: actor.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(eventoImportacoesMapa.id, importRow.id));
      const inventory = event.defaultMapId
        ? await this.sincronizarInventarioMapa(db, eventId, map.id, actor)
        : { inventorySessionIds: [], inventoryCreatedCount: 0 };
      await this.audit(eventId, actor, map.id, { action: "confirmar", reason: corrections.reason ?? null, seats: corrections.seats.length }, db);
      return { confirmed: next, imp: importRow, inventory };
    });
    return { map: confirmed ?? map, seats: corrections.seats, ...inventory };
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

  async migrarSessoesEExcluir(eventId: string, mapId: string, input: { targetMapId: string; sessionIds?: string[] }, actor: EventoActor): Promise<MapMigrationResult> {
    const result = await this.transaction(async (db) => {
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
          storageKeys: [] as string[],
        };
      }

      if (mapId === input.targetMapId) throw new BadRequestException({ code: "SAME_MAP", message: "O mapa de origem e o mapa de destino devem ser diferentes" });
      const eventQuery = db.select().from(eventos).where(eq(eventos.id, eventId));
      const [event] = await this.lockRows(eventQuery);
      if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
      if (actor.role !== "master" && event.schoolId !== actor.schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });

      const sessions = await this.lockRows(db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId)));
      const maps = await this.lockRows(db.select().from(eventoMapas).where(inArray(eventoMapas.id, [mapId, input.targetMapId].sort())));
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
      const inventoryRows = await db.select().from(eventoInventarioAssentos).where(oldSeatIds.size ? inArray(eventoInventarioAssentos.seatId, [...oldSeatIds]) : eq(eventoInventarioAssentos.sessionId, "__nenhuma__"));
      const explicitSessions = sessions.filter((session: any) => session.mapId === mapId);
      const inheritedSessions = sessions.filter((session: any) => session.mapId == null && inventoryRows.some((inventory: any) => inventory.sessionId === session.id && oldSeatIds.has(inventory.seatId)));
      const impacted = [...new Map([...explicitSessions, ...inheritedSessions].map((session: any) => [session.id, session])).values()];
      const migratedSessionIds = impacted.map((session: any) => session.id);
      const inheritedSessionIds = inheritedSessions.map((session: any) => session.id);
      if (input.sessionIds !== undefined) {
        const requested = [...new Set(input.sessionIds)];
        if (requested.length !== migratedSessionIds.length || requested.some((sessionId) => !migratedSessionIds.includes(sessionId))) {
          throw new BadRequestException({ code: "SESSION_SELECTION_INCOMPLETE", message: "A seleção de sessões não contém todas as sessões impactadas" });
        }
      }

      const sessionIds = new Set(migratedSessionIds);
      const impactedInventoryIds = inventoryRows.filter((inventory: any) => sessionIds.has(inventory.sessionId)).map((inventory: any) => inventory.id);
      const pedidos = migratedSessionIds.length
        ? await db.select().from(eventoPedidos).where(inArray(eventoPedidos.sessionId, migratedSessionIds))
        : [];
      const orderIds = new Set(pedidos.filter((pedido: any) => pedido.sessionId === undefined || sessionIds.has(pedido.sessionId)).map((pedido: any) => pedido.id));
      const reservas = impactedInventoryIds.length
        ? await db.select().from(eventoReservas).where(inArray(eventoReservas.inventorySeatId, impactedInventoryIds))
        : [];
      const ingressos = migratedSessionIds.length
        ? await db.select().from(eventoIngressos).where(inArray(eventoIngressos.sessionId, migratedSessionIds))
        : [];
      const checkins = migratedSessionIds.length
        ? await db.select().from(eventoCheckins).where(inArray(eventoCheckins.sessionId, migratedSessionIds))
        : [];
      const operacoes = migratedSessionIds.length
        ? await db.select().from(eventoOperacoesAdministrativas).where(inArray(eventoOperacoesAdministrativas.sessionId, migratedSessionIds))
        : [];
      const dependencyRows = [...pedidos, ...reservas, ...ingressos, ...checkins, ...operacoes].filter((dependency: any) => dependency.sessionId === undefined || sessionIds.has(dependency.sessionId) || dependency.orderId === undefined || orderIds.has(dependency.orderId) || dependency.inventorySeatId === undefined || impactedInventoryIds.includes(dependency.inventorySeatId));
      if (dependencyRows.length) throw new BadRequestException({ code: "SESSION_HAS_DEPENDENCIES", message: "A sessão possui dados operacionais e não pode ser migrada", sessionIds: migratedSessionIds });

      const now = new Date();
      for (const session of explicitSessions) await db.update(eventoSessoes).set({ mapId: input.targetMapId, updatedAt: now }).where(eq(eventoSessoes.id, session.id));
      if (event.defaultMapId === mapId) await db.update(eventos).set({ defaultMapId: input.targetMapId, updatedAt: now }).where(eq(eventos.id, eventId));
      if (migratedSessionIds.length) await db.delete(eventoInventarioAssentos).where(inArray(eventoInventarioAssentos.sessionId, migratedSessionIds));
      let inventoryCreatedCount = 0;
      for (const sessionId of migratedSessionIds) {
        for (const seat of targetSeats) {
          await db.insert(eventoInventarioAssentos).values({ sessionId, seatId: seat.id, status: seat.sellable === false ? "BLOQUEADO" : "DISPONIVEL", blockedReason: seat.sellable === false ? "MAPA_ASSENTO_NAO_VENDAVEL" : null });
          inventoryCreatedCount += 1;
        }
      }
      const metadata = { action: "migrar_sessoes_e_excluir", oldMapId: mapId, targetMapId: input.targetMapId, migratedSessionIds, inheritedSessionIds, inventoryCreatedCount, reason: "migração segura de sessões" };
      await this.audit(eventId, actor, mapId, metadata, db);
      const storageKeys = [oldMap.originalFileKey, oldMap.previewFileKey].filter((key): key is string => typeof key === "string" && key.length > 0);
      try {
        await db.delete(eventoMapas).where(and(eq(eventoMapas.id, mapId), eq(eventoMapas.eventId, eventId)));
      } catch (error) {
        throw new BadRequestException({ code: "MAP_DELETE_BLOCKED", message: "O mapa antigo ainda possui referências e não pode ser excluído", cause: error instanceof Error ? error.message : String(error) });
      }
      return { oldMapId: mapId, targetMapId: input.targetMapId, migratedSessionIds, inheritedSessionIds, inventoryCreatedCount, deletedMap: { deleted: true, code: "DELETED" as const }, storageKeys };
    });
    if (result.storageKeys && this.storage) {
      await Promise.all(result.storageKeys.map((key: string) => this.storage!.deleteFile(key).catch(() => undefined)));
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
      let previousMapArchive: MapReplacementResult["previousMapArchive"] = { archived: false, code: "NO_PREVIOUS_MAP" };
      if (previousMapId) {
        const references = sessions.filter((session: any) => session.mapId === previousMapId).map((session: any) => session.id);
        if (references.length) {
          previousMapArchive = { archived: false, code: "MAP_IN_USE", sessionIds: references };
        } else {
          const [archived] = await db.update(eventoMapas).set({ status: "ARQUIVADO", updatedAt: now }).where(and(eq(eventoMapas.id, previousMapId), eq(eventoMapas.eventId, eventId))).returning();
          if (archived) previousMapArchive = { archived: true, code: "ARCHIVED" };
        }
      }
      await this.audit(eventId, actor, eventId, { action: "substituir_mapa_padrao", previousMapId, nextMapId: mapId, inheritedSessionIds: inherited.map((session: any) => session.id), inventorySessionIds: inventory.inventorySessionIds, inventoryCreatedCount: inventory.inventoryCreatedCount, previousMapArchive }, db);
      return { updated, previousMapId, inheritedSessionIds: inherited.map((session: any) => session.id), inventory, previousMapArchive, previousMapPreviewKey: previousMapId ? (await db.select().from(eventoMapas).where(eq(eventoMapas.id, previousMapId)))[0]?.previewFileKey : null };
    });
    if (result.previousMapArchive.archived && result.previousMapPreviewKey && this.storage) await this.storage.deleteFile(result.previousMapPreviewKey).catch(() => undefined);
    return { updated: result.updated, previousMapId: result.previousMapId, inheritedSessionIds: result.inheritedSessionIds, inventorySessionIds: result.inventory.inventorySessionIds, inventoryCreatedCount: result.inventory.inventoryCreatedCount, previousMapArchive: result.previousMapArchive };
  }
}
