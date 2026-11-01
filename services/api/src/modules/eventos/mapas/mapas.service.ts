import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { and, desc, eq, inArray, eventoAuditorias, eventoDeteccoesMapa, eventoImportacoesMapa, eventoInventarioAssentos, eventoMapaAssentos, eventoMapas, eventoSessoes, eventos, type Database } from "@essencia/db";
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
