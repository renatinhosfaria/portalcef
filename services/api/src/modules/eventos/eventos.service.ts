import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, eventoAuditorias, eventoInventarioAssentos, eventoLocais, eventoMapaAssentos, eventoMapas, eventoPedidos, eventoPoliticas, eventoSessoes, eventoTiposIngresso, eventos, inArray, ne, type Database } from "@essencia/db";
import type { AtualizarEventoInput, CriarEventoInput, CriarSessaoInput, CriarRascunhoInput, EventoListQuery } from "@essencia/shared/schemas";
import type { EventoActor, EventoResumo, PublicEventCard, PublicEventDetail, PublicEventSession, PublicMap } from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";
import { EventosRulesService } from "./eventos-rules.service";

export function assertSchoolScope(actor: EventoActor, schoolId: string) {
  if (actor.role === "master") return;
  if (!actor.schoolId || actor.schoolId !== schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Acesso negado" });
}

@Injectable()
export class EventosService {
  constructor(private readonly database: DatabaseService, private readonly rules: EventosRulesService) {}
  private get db(): Database { return this.database.db; }
  private normalizeSlug(slug: string) { return slug.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  private resumo(event: typeof eventos.$inferSelect): EventoResumo { return { id: event.id, schoolId: event.schoolId, slug: event.slug, title: event.title, status: event.status as EventoResumo["status"], publishedAt: event.publishedAt, plannedPublicationAt: event.plannedPublicationAt }; }
  private assertSchoolScope(actor: EventoActor, schoolId: string) {
    assertSchoolScope(actor, schoolId);
  }
  private salesAvailability(session: { salesStartsAt: Date | null; salesEndsAt: Date | null }, now = new Date()): "available" | "unavailable" {
    if (session.salesStartsAt && now < session.salesStartsAt) return "unavailable";
    if (session.salesEndsAt && now >= session.salesEndsAt) return "unavailable";
    return "available";
  }

  private async audit(eventId: string, actor: EventoActor | undefined, action: "CRIADO" | "ATUALIZADO" | "PUBLICADO" | "PAUSADO" | "CANCELADO", resourceType: string, resourceId: string, metadata?: unknown, db: Database = this.db) {
    if (!actor?.userId || typeof (db as any).insert !== "function") return;
    await db.insert(eventoAuditorias).values({ eventId, actorId: actor.userId, actorRole: actor.role, action, resourceType, resourceId, metadata: metadata ?? null });
  }

  async criarRascunho(input: CriarRascunhoInput, actor: EventoActor): Promise<EventoResumo> {
    if (!actor.schoolId && actor.role !== "master") throw new BadRequestException({ code: "FORBIDDEN", message: "Escola obrigatória" });
    const schoolId = actor.schoolId;
    if (!schoolId) throw new BadRequestException({ code: "SCHOOL_REQUIRED", message: "Informe a escola na sessão" });
    const base = this.normalizeSlug(input.title) || "evento";
    let slug = base;
    for (let suffix = 2; ; suffix += 1) {
      const [existing] = await this.db.select({ id: eventos.id }).from(eventos).where(and(eq(eventos.schoolId, schoolId), eq(eventos.slug, slug))).limit(1);
      if (!existing) break;
      slug = `${base}-${suffix}`;
    }
    const [event] = await this.db.insert(eventos).values({ schoolId, title: input.title.trim(), slug, status: "RASCUNHO", description: null, summary: null, cancellationPolicy: null, contactEmail: null, publishedAt: null, plannedPublicationAt: null }).returning();
    if (!event) throw new BadRequestException({ code: "EVENT_CREATE_FAILED", message: "Não foi possível criar o evento" });
    await this.audit(event.id, actor, "CRIADO", "evento", event.id);
    return this.resumo(event);
  }

  async criarEvento(input: CriarEventoInput, actor: EventoActor): Promise<EventoResumo> {
    this.assertSchoolScope(actor, input.schoolId);
    const slug = this.normalizeSlug(input.slug);
    const { publishImmediately, sessions, ticketTypes, policies, ...eventInput } = input;
    let event: typeof eventos.$inferSelect | undefined;
    try {
      [event] = await this.db.insert(eventos).values({ ...eventInput, slug, status: "RASCUNHO", publishedAt: null, plannedPublicationAt: input.plannedPublicationAt ?? null, defaultLocationId: input.defaultLocationId ?? null, defaultMapId: input.defaultMapId ?? null }).returning();
      if (!event) throw new BadRequestException({ code: "EVENT_CREATE_FAILED", message: "Não foi possível criar o evento" });
      for (const session of sessions) await this.criarSessao(event.id, session, actor, false);
      for (const ticket of ticketTypes) await this.db.insert(eventoTiposIngresso).values({ eventId: event.id, name: ticket.name, description: ticket.description ?? null, priceCents: ticket.priceCents, eligibility: ticket.eligibility ?? null, maxPerOrder: ticket.maxPerOrder ?? null, salesLot: ticket.salesLot ?? null, rules: ticket.rules ?? null });
      for (const policy of policies) await this.upsertPolitica(event.id, policy, actor);
      await this.audit(event.id, actor, "CRIADO", "evento", event.id);
    } catch (error) {
      if (event?.id && typeof (this.db as any).delete === "function") await this.db.delete(eventos).where(eq(eventos.id, event.id));
      throw error;
    }
    if (publishImmediately) {
      try {
        await this.rules.validarPublicacao(event.id);
        const [published] = await this.db.update(eventos).set({ status: "PUBLICADO", publishedAt: new Date(), updatedAt: new Date() }).where(eq(eventos.id, event.id)).returning();
        await this.db.update(eventoSessoes).set({ status: "PUBLICADA", updatedAt: new Date() }).where(and(eq(eventoSessoes.eventId, event.id), eq(eventoSessoes.status, "RASCUNHO")));
        await this.audit(event.id, actor, "PUBLICADO", "evento", event.id);
        return this.resumo(published ?? event);
      } catch (error) {
        if (typeof (this.db as any).delete === "function") await this.db.delete(eventos).where(eq(eventos.id, event.id));
        throw error;
      }
    }
    return this.resumo(event);
  }

  async atualizarEvento(id: string, input: AtualizarEventoInput, actor: EventoActor, expectedUpdatedAt?: Date): Promise<EventoResumo> {
    const [existing] = await this.db.select().from(eventos).where(eq(eventos.id, id));
    if (!existing) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    this.assertSchoolScope(actor, existing.schoolId);
    const { publishImmediately, updatedAt, expectedUpdatedAt: inputExpectedUpdatedAt, sessions: _sessions, ticketTypes: _ticketTypes, policies: _policies, ...updateInput } = input;
    const expected = expectedUpdatedAt ?? inputExpectedUpdatedAt ?? updatedAt;
    if (expected && existing.updatedAt && existing.updatedAt.getTime() !== expected.getTime()) throw new ConflictException({ code: "VERSION_CONFLICT", message: "O evento foi alterado por outra pessoa", current: this.resumo(existing) });
    if (_sessions !== undefined || _ticketTypes !== undefined || _policies !== undefined) throw new BadRequestException({ code: "EVENT_UPDATE_FIELDS_UNSUPPORTED", message: "Atualize sessões, ingressos e políticas pelas rotas próprias" });
    const normalizedSlug = input.slug ? this.normalizeSlug(input.slug) : undefined;
    if (input.slug !== undefined && existing.status === "PUBLICADO") throw new BadRequestException({ code: "EVENT_SLUG_IMMUTABLE", message: "O slug de um evento publicado não pode ser alterado" });
    if (normalizedSlug && normalizedSlug !== existing.slug) {
      const [slugOwner] = await this.db.select({ id: eventos.id }).from(eventos).where(and(eq(eventos.schoolId, existing.schoolId), eq(eventos.slug, normalizedSlug), ne(eventos.id, id))).limit(1);
      if (slugOwner) throw new ConflictException({ code: "SLUG_ALREADY_EXISTS", message: "Este slug já está em uso nesta escola" });
    }
    const [sales] = await this.db.select({ id: eventoPedidos.id }).from(eventoPedidos).where(eq(eventoPedidos.eventId, id)).limit(1);
    if (sales) throw new BadRequestException({ code: "EVENT_HAS_SALES", message: "O evento possui vendas; crie uma nova versão antes de alterar sua configuração" });
    const titleSuggestion = input.title ? this.normalizeSlug(input.title) : undefined;
    const manualSlug = existing.slug !== this.normalizeSlug(existing.title);
    const nextSlug = normalizedSlug ?? (input.title && !manualSlug ? titleSuggestion : undefined);
    const nextUpdatedAt = new Date();
    const versionFilter = expected ? and(eq(eventos.id, id), eq(eventos.updatedAt, expected)) : eq(eventos.id, id);
    const [updated] = await this.db.update(eventos).set({ ...updateInput, slug: nextSlug, updatedAt: nextUpdatedAt }).where(versionFilter).returning();
    if (!updated) {
      if (expected) throw new ConflictException({ code: "VERSION_CONFLICT", message: "O evento foi alterado por outra pessoa", current: this.resumo(existing) });
      throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    }
    const nextValues = { ...updateInput, ...(nextSlug ? { slug: nextSlug } : {}) } as Record<string, unknown>;
    const previousValues = Object.fromEntries(Object.keys(nextValues).map((key) => [key, (existing as Record<string, unknown>)[key]]));
    await this.audit(id, actor, "ATUALIZADO", "evento", id, { etapa: input.defaultMapId !== undefined ? "mapa" : "informacoes", version: existing.updatedAt?.toISOString(), previous: previousValues, next: nextValues });
    if (publishImmediately) return this.publicar(id, actor);
    const result = this.resumo(updated);
    if (input.title && !normalizedSlug && manualSlug && titleSuggestion && titleSuggestion !== existing.slug) result.slugSuggestion = titleSuggestion;
    return result;
  }

  async atualizarMapaPadrao(eventId: string, mapId: string, actor: EventoActor) {
    const [event] = await this.db.select().from(eventos).where(eq(eventos.id, eventId));
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    this.assertSchoolScope(actor, event.schoolId);
    const transaction = (this.db as any).transaction;
    const run = async (db: any) => {
      const now = new Date();
      const [map] = await db.select().from(eventoMapas).where(eq(eventoMapas.id, mapId));
      if (!map) throw new NotFoundException({ code: "MAP_NOT_FOUND", message: "Mapa não encontrado" });
      if (map.eventId !== eventId) throw new BadRequestException({ code: "MAP_EVENT_MISMATCH", message: "O mapa informado pertence a outro evento" });
      const sessions = await db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId));
      const inherited = sessions.filter((session: any) => session.mapId == null);
      const [updated] = await db.update(eventos).set({ defaultMapId: mapId, updatedAt: now }).where(eq(eventos.id, eventId)).returning();
      if (!updated) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
      for (const session of inherited) {
        await db.update(eventoInventarioAssentos).set({ status: "BLOQUEADO", blockedReason: "MAPA_PADRAO_ALTERADO", updatedAt: now }).where(and(eq(eventoInventarioAssentos.sessionId, session.id), inArray(eventoInventarioAssentos.status, ["DISPONIVEL", "LIBERADO"])));
      }
      await this.audit(eventId, actor, "ATUALIZADO", "mapa_padrao", eventId, { etapa: "mapa", previousMapId: event.defaultMapId, nextMapId: mapId, inheritedSessionIds: inherited.map((session: any) => session.id), inventory: "REVISAR_REGENERAR" }, db);
      return { updated, inheritedSessionIds: inherited.map((session: any) => session.id) };
    };
    const result = typeof transaction === "function" ? await transaction.call(this.db, run) : await run(this.db);
    return { ...this.resumo(result.updated), inheritedSessionIds: result.inheritedSessionIds, inventoryRequiresReview: result.inheritedSessionIds.length > 0 };
  }

  async listarAdmin(query: EventoListQuery = {}, actor?: EventoActor) {
    if (!actor) throw new BadRequestException({ code: "FORBIDDEN", message: "Usuário administrativo obrigatório" });
    const filters = query.status ? [eq(eventos.status, query.status)] : [];
    if (actor.role !== "master") {
      if (!actor.schoolId) throw new BadRequestException({ code: "FORBIDDEN", message: "Escola obrigatória" });
      filters.push(eq(eventos.schoolId, actor.schoolId));
    }
    const rows = await this.db.select().from(eventos).where(filters.length ? and(...filters) : undefined);
    const search = query.search?.trim().toLowerCase();
    return rows.filter((row: any) => !search || row.title.toLowerCase().includes(search) || row.slug.includes(search)).map((row: any) => this.resumo(row));
  }

  async criarSessao(eventId: string, input: CriarSessaoInput, actor?: EventoActor, audit = true) {
    const [event] = await this.db.select().from(eventos).where(eq(eventos.id, eventId));
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    if (actor) this.assertSchoolScope(actor, event.schoolId);
    if (input.status === "PUBLICADA") throw new BadRequestException({ code: "SESSION_PUBLICATION_REQUIRES_INVENTORY", message: "Publique a sessão pelo fluxo de publicação após inicializar o inventário" });
    const [session] = await this.db.insert(eventoSessoes).values({ eventId, startsAt: input.startsAt, endsAt: input.endsAt, capacity: input.capacity, locationId: input.locationId ?? event.defaultLocationId, mapId: input.mapId ?? null, salesStartsAt: input.salesStartsAt ?? null, salesEndsAt: input.salesEndsAt ?? null, status: input.status ?? "RASCUNHO" }).returning();
    if (audit && session) await this.audit(eventId, actor, "ATUALIZADO", "sessao", session.id);
    return session;
  }

  async atualizarSessao(eventId: string, sessionId: string, input: Partial<CriarSessaoInput>, actor?: EventoActor) {
    const [session] = await this.db.select().from(eventoSessoes).where(and(eq(eventoSessoes.id, sessionId), eq(eventoSessoes.eventId, eventId)));
    if (!session) throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "Sessão não encontrada" });
    if (actor) {
      const [event] = await this.db.select().from(eventos).where(eq(eventos.id, eventId));
      if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
      this.assertSchoolScope(actor, event.schoolId);
    }
    const [sale] = await this.db.select({ id: eventoPedidos.id }).from(eventoPedidos).where(eq(eventoPedidos.sessionId, sessionId)).limit(1);
    if (sale) throw new BadRequestException({ code: "EVENT_HAS_SALES", message: "A sessão possui vendas e não pode ser alterada" });
    if (input.status === "PUBLICADA") throw new BadRequestException({ code: "SESSION_PUBLICATION_REQUIRES_INVENTORY", message: "Publique a sessão pelo fluxo de publicação após inicializar o inventário" });
    const [updated] = await this.db.update(eventoSessoes).set({ ...input, updatedAt: new Date() }).where(eq(eventoSessoes.id, sessionId)).returning();
    if (updated) await this.audit(eventId, actor, "ATUALIZADO", "sessao", sessionId);
    return updated;
  }

  async listarPublicados(now: Date): Promise<PublicEventCard[]> {
    const rows = await this.db.select({ event: eventos, session: eventoSessoes, location: eventoLocais, ticket: eventoTiposIngresso, inventory: eventoInventarioAssentos }).from(eventos).innerJoin(eventoSessoes, and(eq(eventoSessoes.eventId, eventos.id), eq(eventoSessoes.status, "PUBLICADA"))).leftJoin(eventoLocais, eq(eventoLocais.id, eventoSessoes.locationId)).leftJoin(eventoTiposIngresso, and(eq(eventoTiposIngresso.eventId, eventos.id), eq(eventoTiposIngresso.active, true))).leftJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.sessionId, eventoSessoes.id)).where(eq(eventos.status, "PUBLICADO"));
    const byId = new Map<string, PublicEventCard>();
    for (const row of rows) {
      if (row.event.publishedAt && row.event.publishedAt > now) continue;
      const prior = byId.get(row.event.id);
      const available = this.salesAvailability(row.session, now) === "available" && (row.inventory?.status === "DISPONIVEL" || row.inventory?.status === "LIBERADO");
      const price = row.ticket?.priceCents ?? null;
      byId.set(row.event.id, { id: row.event.id, slug: row.event.slug, title: row.event.title, summary: row.event.summary, imageUrl: row.event.imageUrl, category: row.event.category, startsAt: prior?.startsAt ?? row.session.startsAt, locationName: prior?.locationName ?? row.location?.name ?? null, fromPriceCents: prior?.fromPriceCents == null ? price : price == null ? prior.fromPriceCents : Math.min(prior.fromPriceCents, price), availability: prior?.availability === "available" || available ? "available" : "sold_out" });
    }
    return [...byId.values()].sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));
  }

  async getPublicBySlug(slug: string, now = new Date()): Promise<PublicEventDetail> {
    const card = (await this.listarPublicados(now)).find((item) => item.slug === this.normalizeSlug(slug));
    if (!card) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    const [event] = await this.db.select().from(eventos).where(eq(eventos.id, card.id));
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    return { ...card, description: event.description, contactEmail: event.contactEmail, contactPhone: event.contactPhone, cancellationPolicy: event.cancellationPolicy };
  }

  async listarSessoesPublicas(slug: string, now = new Date()): Promise<PublicEventSession[]> {
    const detail = await this.getPublicBySlug(slug, now);
    const ticketTypes = await this.db.select().from(eventoTiposIngresso).where(and(eq(eventoTiposIngresso.eventId, detail.id), eq(eventoTiposIngresso.active, true))).orderBy(asc(eventoTiposIngresso.name));
    const publicTicketTypes = ticketTypes.map((ticket: typeof eventoTiposIngresso.$inferSelect) => ({ id: ticket.id, name: ticket.name, description: ticket.description, priceCents: ticket.priceCents, maxPerOrder: ticket.maxPerOrder, eligibility: ticket.eligibility }));
    const rows = await this.db.select({ session: eventoSessoes, location: eventoLocais, inventory: eventoInventarioAssentos }).from(eventoSessoes).leftJoin(eventoLocais, eq(eventoLocais.id, eventoSessoes.locationId)).leftJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.sessionId, eventoSessoes.id)).where(and(eq(eventoSessoes.eventId, detail.id), eq(eventoSessoes.status, "PUBLICADA"))).orderBy(asc(eventoSessoes.startsAt));
    const result = new Map<string, PublicEventSession>();
    for (const row of rows) {
      const existing = result.get(row.session.id);
      const available = this.salesAvailability(row.session) === "available" && (row.inventory?.status === "DISPONIVEL" || row.inventory?.status === "LIBERADO");
      if (existing) { if (available) existing.availability = "available"; continue; }
      result.set(row.session.id, { id: row.session.id, startsAt: row.session.startsAt, endsAt: row.session.endsAt, status: "PUBLICADA", capacity: row.session.capacity, mapId: row.session.mapId, salesStartsAt: row.session.salesStartsAt, salesEndsAt: row.session.salesEndsAt, location: row.location ? { name: row.location.name, address: row.location.address, room: row.location.room, instructions: row.location.instructions, accessibility: row.location.accessibility } : null, availability: available ? "available" : "sold_out", ticketTypes: publicTicketTypes });
    }
    return [...result.values()];
  }

  async getPublicMap(sessionId: string): Promise<PublicMap> {
    const [session] = await this.db.select().from(eventoSessoes).where(eq(eventoSessoes.id, sessionId));
    if (!session || session.status !== "PUBLICADA" || !session.mapId) throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "Sessão não encontrada" });
    const [parentEvent] = await this.db.select().from(eventos).where(eq(eventos.id, session.eventId));
    if (!parentEvent || parentEvent.status !== "PUBLICADO") throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    const [map] = await this.db.select().from(eventoMapas).where(eq(eventoMapas.id, session.mapId));
    if (!map || map.status !== "CONFIRMADO") throw new NotFoundException({ code: "MAP_NOT_CONFIRMED", message: "Mapa não disponível" });
    const rows = await this.db.select({ seat: eventoMapaAssentos, inventory: eventoInventarioAssentos }).from(eventoInventarioAssentos).innerJoin(eventoMapaAssentos, eq(eventoMapaAssentos.id, eventoInventarioAssentos.seatId)).where(eq(eventoInventarioAssentos.sessionId, sessionId));
    return { sessionId, mapId: session.mapId, seats: rows.map(({ seat, inventory }: any) => ({ id: seat.id, sessionId, rowLabel: seat.rowLabel, seatNumber: seat.seatNumber, x: seat.x, y: seat.y, width: seat.width, height: seat.height, category: seat.category, accessible: seat.accessible, state: inventory.status === "VENDIDO" ? "sold" : inventory.status === "RESERVADO" ? "reserved" : inventory.status === "BLOQUEADO" ? "blocked" : "available" })) };
  }

  async publicar(id: string, actor?: EventoActor) {
    const [existing] = await this.db.select().from(eventos).where(eq(eventos.id, id));
    if (!existing) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    if (actor) this.assertSchoolScope(actor, existing.schoolId);
    await this.rules.validarPublicacao(id);
    const [event] = await this.db.update(eventos).set({ status: "PUBLICADO", publishedAt: new Date(), updatedAt: new Date() }).where(eq(eventos.id, id)).returning();
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    await this.db.update(eventoSessoes).set({ status: "PUBLICADA", updatedAt: new Date() }).where(and(eq(eventoSessoes.eventId, id), eq(eventoSessoes.status, "RASCUNHO")));
    await this.audit(id, actor, "PUBLICADO", "evento", id);
    return this.resumo(event);
  }

  async alterarStatus(id: string, status: "PAUSADO" | "CANCELADO", actor?: EventoActor) { const [existing] = await this.db.select().from(eventos).where(eq(eventos.id, id)); if (!existing) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" }); if (actor) this.assertSchoolScope(actor, existing.schoolId); const [event] = await this.db.update(eventos).set({ status, updatedAt: new Date() }).where(eq(eventos.id, id)).returning(); if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" }); await this.audit(id, actor, status === "PAUSADO" ? "PAUSADO" : "CANCELADO", "evento", id); return this.resumo(event); }
  async listarInventario(eventId: string, actor: EventoActor) { const [event] = await this.db.select().from(eventos).where(eq(eventos.id, eventId)); if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" }); this.assertSchoolScope(actor, event.schoolId); return this.db.select({ session: eventoSessoes, inventory: eventoInventarioAssentos }).from(eventoSessoes).innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.sessionId, eventoSessoes.id)).where(eq(eventoSessoes.eventId, eventId)); }

  async listarPoliticas(eventId: string, actor?: EventoActor) { const [event] = await this.db.select().from(eventos).where(eq(eventos.id, eventId)); if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" }); if (actor) this.assertSchoolScope(actor, event.schoolId); return this.db.select().from(eventoPoliticas).where(and(eq(eventoPoliticas.eventId, eventId), eq(eventoPoliticas.active, true))); }
  private async upsertPolitica(eventId: string, input: { type: "PRIVACIDADE" | "COMPRA" | "CANCELAMENTO_REEMBOLSO" | "ACESSIBILIDADE" | "CONTATO"; content: string; version?: number }, actor: EventoActor) {
    const current: any[] = await this.db.select().from(eventoPoliticas).where(eq(eventoPoliticas.eventId, eventId));
    const nextVersion = input.version ?? Math.max(0, ...current.filter((p: any) => p.type === input.type).map((p: any) => p.version)) + 1;
    await this.db.update(eventoPoliticas).set({ active: false }).where(and(eq(eventoPoliticas.eventId, eventId), eq(eventoPoliticas.type, input.type), eq(eventoPoliticas.active, true)));
    const [created] = await this.db.insert(eventoPoliticas).values({ eventId, type: input.type, content: input.content, version: nextVersion, active: true, effectiveAt: new Date(), createdBy: actor.userId }).returning();
    return created;
  }
  async atualizarPoliticas(eventId: string, inputs: { type: "PRIVACIDADE" | "COMPRA" | "CANCELAMENTO_REEMBOLSO" | "ACESSIBILIDADE" | "CONTATO"; content: string; version?: number }[], actor: EventoActor) { const [event] = await this.db.select().from(eventos).where(eq(eventos.id, eventId)); if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" }); this.assertSchoolScope(actor, event.schoolId); const created = []; for (const input of inputs) created.push(await this.upsertPolitica(eventId, input, actor)); await this.audit(eventId, actor, "ATUALIZADO", "politica", eventId); return created; }
}
