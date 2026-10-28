import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, eventoInventarioAssentos, eventoMapas, eventoPoliticas, eventoSessoes, eventoTiposIngresso, eventos } from "@essencia/db";
import { DatabaseService } from "../../common/database/database.service";

@Injectable()
export class EventosRulesService {
  constructor(private readonly database: DatabaseService) {}
  async validarPublicacao(eventId: string): Promise<void> {
    const db = this.database.db;
    const [event] = await db.select().from(eventos).where(eq(eventos.id, eventId));
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    if (!event.title?.trim() || !event.description?.trim() || !event.cancellationPolicy?.trim() || !event.contactEmail?.trim()) this.fail("REQUIRED_TEXT_MISSING", "Preencha os textos obrigatórios");
    if (!event.defaultMapId) this.fail("MAP_NOT_CONFIRMED", "O mapa precisa estar confirmado");
    const [map] = await db.select().from(eventoMapas).where(eq(eventoMapas.id, event.defaultMapId));
    if (!map || map.status !== "CONFIRMADO") this.fail("MAP_NOT_CONFIRMED", "O mapa precisa estar confirmado");
    const sessions = await db.select().from(eventoSessoes).where(eq(eventoSessoes.eventId, eventId));
    if (!sessions.length) this.fail("SESSION_REQUIRED", "Crie ao menos uma sessão");
    for (const session of sessions) {
      if (session.endsAt <= session.startsAt || session.capacity <= 0) this.fail("INVALID_SESSION", "Sessão inválida");
      if (event.plannedPublicationAt && session.salesStartsAt && session.salesStartsAt < event.plannedPublicationAt) this.fail("INVALID_SALES_WINDOW", "A venda não pode começar antes da publicação prevista");
      if (session.salesStartsAt && session.salesEndsAt && session.salesEndsAt <= session.salesStartsAt) this.fail("INVALID_SALES_WINDOW", "Janela de vendas inválida");
      if (session.salesEndsAt && session.salesEndsAt > session.startsAt) this.fail("INVALID_SALES_WINDOW", "A venda deve terminar antes do início da sessão");
      const effectiveMapId = session.mapId ?? event.defaultMapId;
      const [sm] = await db.select().from(eventoMapas).where(eq(eventoMapas.id, effectiveMapId));
      if (!sm || sm.status !== "CONFIRMADO") this.fail("MAP_NOT_CONFIRMED", "O mapa da sessão precisa estar confirmado");
    }
    const ticketTypes = await db.select().from(eventoTiposIngresso).where(and(eq(eventoTiposIngresso.eventId, eventId), eq(eventoTiposIngresso.active, true)));
    if (!ticketTypes.length) this.fail("TICKET_TYPE_REQUIRED", "Configure ao menos um tipo de ingresso");
    if (ticketTypes.some((ticket: any) => ticket.priceCents < 0)) this.fail("INVALID_PRICE", "Preço inválido");
    const policies = await db.select().from(eventoPoliticas).where(and(eq(eventoPoliticas.eventId, eventId), eq(eventoPoliticas.active, true)));
    const requiredPolicies = ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"] as const;
    if (requiredPolicies.some((type) => !policies.some((policy: any) => policy.type === type))) this.fail("POLICY_REQUIRED", "Associe todas as políticas padrão ao evento");
    for (const ticket of ticketTypes) {
      if (!Number.isInteger(ticket.priceCents) || ticket.priceCents < 0) this.fail("INVALID_PRICE", "Preço inválido");
      if (ticket.maxPerOrder !== null && ticket.maxPerOrder !== undefined && (!Number.isInteger(ticket.maxPerOrder) || ticket.maxPerOrder <= 0)) this.fail("INVALID_TICKET_RULE", "Limite de ingressos inválido");
    }
    for (const session of sessions) {
      const inventory = await db.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.sessionId, session.id));
      if (inventory.length < session.capacity) this.fail("INVENTORY_INSUFFICIENT", "O inventário da sessão é insuficiente");
    }
  }
  private fail(code: string, message: string): never { throw new BadRequestException({ code, message }); }
}
