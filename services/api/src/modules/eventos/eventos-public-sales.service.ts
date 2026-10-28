import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, eventoAceites, eventoInventarioAssentos, eventoItensPedido, eventoPagamentos, eventoParticipantes, eventoPedidos, eventoPoliticas, eventoReservas, eventoSessoes, eventoTiposIngresso, eventos, lte, type Database } from "@essencia/db";
import type { CheckoutPublicoInput, FinalizarPedidoInput, ReservaPublicaInput } from "@essencia/shared/schemas";
import type { ConsultaPedidoPublica, PedidoPublicoResult, PoliticaPublica, ReservaPublicaResult } from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";

const CODE = (code: string, message: string) => new BadRequestException({ code, message });

@Injectable()
export class EventosPublicSalesService {
  constructor(private readonly database: DatabaseService) {}
  private get db(): Database { return this.database.db; }
  private async first<T>(query: any): Promise<T | undefined> { const rows = await query; return rows?.[0]; }
  private orderNumber() { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""); }
  private normalizePhone(phone: string) { return phone.replace(/\D/g, "").slice(0, 30); }

  async listarPoliticasPublicas(slug: string): Promise<PoliticaPublica[]> {
    const event = await this.first<any>(this.db.select().from(eventos).where(and(eq(eventos.slug, slug), eq(eventos.status, "PUBLICADO"))));
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    const rows = await this.db.select().from(eventoPoliticas).where(and(eq(eventoPoliticas.eventId, event.id), eq(eventoPoliticas.active, true))).orderBy(desc(eventoPoliticas.version));
    const latest = new Map<string, PoliticaPublica>();
    for (const row of rows) if (!latest.has(row.type)) latest.set(row.type, { type: row.type as PoliticaPublica["type"], version: row.version, content: row.content });
    return [...latest.values()];
  }

  async reservarAssentos(input: ReservaPublicaInput & { schoolId?: string; [key: string]: unknown }): Promise<ReservaPublicaResult> {
    if (input.seats.length === 0) throw CODE("SEATS_REQUIRED", "Selecione ao menos um assento");
    const existing = await this.first<any>(this.db.select().from(eventoPedidos).where(eq(eventoPedidos.idempotencyKey, input.idempotencyKey)));
    if (existing) {
      if (existing.buyerEmail !== input.buyer.email.trim().toLowerCase()) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Chave de idempotência já utilizada" });
      return this.consultaReserva(existing);
    }
    return this.db.transaction(async (tx: any) => {
      const event = await this.first<any>(tx.select().from(eventos).innerJoin(eventoSessoes, eq(eventoSessoes.eventId, eventos.id)).where(and(eq(eventoSessoes.id, input.sessionId), eq(eventos.status, "PUBLICADO"), eq(eventoSessoes.status, "PUBLICADA"))));
      const eventRow = event?.event ?? event;
      const session = event?.evento_sessoes ?? event?.session ?? eventRow?.session;
      if (!eventRow || !session) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento ou sessão não encontrados" });
      const now = new Date();
      if ((session.salesStartsAt && now < session.salesStartsAt) || (session.salesEndsAt && now >= session.salesEndsAt)) throw CODE("EVENT_NOT_FOUND", "Sessão fora do período de vendas");
      const items: any[] = [];
      for (const seat of input.seats) {
        const inventory = await this.first<any>(tx.select().from(eventoInventarioAssentos).where(and(eq(eventoInventarioAssentos.sessionId, input.sessionId), eq(eventoInventarioAssentos.seatId, seat.seatId))));
        if (!inventory || !["DISPONIVEL", "LIBERADO"].includes(inventory.status) || (inventory.reservationExpiresAt && inventory.reservationExpiresAt > now)) throw new ConflictException({ code: "SEAT_UNAVAILABLE", message: "Assento indisponível" });
        const ticket = await this.first<any>(tx.select().from(eventoTiposIngresso).where(and(eq(eventoTiposIngresso.id, seat.ticketTypeId), eq(eventoTiposIngresso.eventId, eventRow.id), eq(eventoTiposIngresso.active, true))));
        if (!ticket) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Ingresso não encontrado" });
        items.push({ inventory, ticket, seat });
      }
      const totalCents = items.reduce((sum, item) => sum + item.ticket.priceCents, 0);
      const expiresAt = new Date(now.getTime() + 15 * 60_000);
      let order: any;
      for (let attempt = 0; attempt < 3 && !order; attempt += 1) {
        try {
          [order] = await tx.insert(eventoPedidos).values({ eventId: eventRow.id, sessionId: input.sessionId, orderNumber: this.orderNumber(), buyerName: input.buyer.name.trim(), buyerEmail: input.buyer.email.trim().toLowerCase(), buyerPhone: this.normalizePhone(input.buyer.phone), status: "INICIADO", totalCents, idempotencyKey: input.idempotencyKey, expiresAt }).returning();
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
      if (!order) throw CODE("ORDER_CREATE_FAILED", "Não foi possível criar o pedido");
      for (const item of items) {
        const updateQuery = tx.update(eventoInventarioAssentos).set({ status: "RESERVADO", reservationExpiresAt: expiresAt, reservedByOrderId: order.id, updatedAt: now }).where(and(eq(eventoInventarioAssentos.id, item.inventory.id), eq(eventoInventarioAssentos.status, item.inventory.status)));
        const updated = typeof updateQuery.returning === "function" ? await updateQuery.returning() : await updateQuery;
        if (Array.isArray(updated) && !updated.length) throw new ConflictException({ code: "SEAT_UNAVAILABLE", message: "Assento indisponível" });
        await tx.insert(eventoReservas).values({ orderId: order.id, inventorySeatId: item.inventory.id, idempotencyKey: `${input.idempotencyKey}:${item.seat.seatId}`, status: "ATIVA", expiresAt });
        await tx.insert(eventoItensPedido).values({ orderId: order.id, inventorySeatId: item.inventory.id, ticketTypeId: item.ticket.id, quantity: 1, unitPriceCents: item.ticket.priceCents, totalPriceCents: item.ticket.priceCents, pricingEvidence: { source: "eventoTiposIngresso", ticketTypeVersion: item.ticket.version } });
      }
      return { reservationId: order.id, orderNumber: order.orderNumber, expiresAt, totalCents, items: items.map((item) => ({ seatId: item.seat.seatId, ticketTypeId: item.ticket.id, unitPriceCents: item.ticket.priceCents, totalPriceCents: item.ticket.priceCents })) };
    });
  }

  private async consultaReserva(order: any): Promise<ReservaPublicaResult> { return { reservationId: order.id, orderNumber: order.orderNumber, expiresAt: order.expiresAt, totalCents: order.totalCents, items: [] }; }
  async finalizarPedidoConvidado(orderNumber: string, input: FinalizarPedidoInput): Promise<PedidoPublicoResult> { const order = await this.getOrder(orderNumber); const policies = await this.db.select().from(eventoPoliticas).where(and(eq(eventoPoliticas.eventId, order.eventId), eq(eventoPoliticas.active, true))); for (const acceptance of input.acceptances) { const policy = policies.find((p: any) => p.type === acceptance.type && p.version === acceptance.version); if (!policy) throw CODE("POLICY_VERSION_MISMATCH", "Versão de política inválida"); await this.db.insert(eventoAceites).values({ orderId: order.id, type: acceptance.type, policyId: policy.id, policyVersion: policy.version, acceptedByName: order.buyerName, acceptedByEmail: order.buyerEmail }); } for (const participant of input.participants) await this.db.insert(eventoParticipantes).values({ eventId: order.eventId, orderId: order.id, type: participant.type, fullName: participant.fullName, email: participant.email ?? null, phone: participant.phone ?? null }); await this.db.update(eventoPedidos).set({ status: "RESERVADO", updatedAt: new Date() }).where(eq(eventoPedidos.id, order.id)); return this.consultarPedido(orderNumber); }
  async iniciarCheckout(orderNumber: string, input: CheckoutPublicoInput) { const order = await this.getOrder(orderNumber); const payment = await this.first<any>(this.db.select().from(eventoPagamentos).where(eq(eventoPagamentos.orderId, order.id))); if (!payment) await this.db.insert(eventoPagamentos).values({ orderId: order.id, method: "card", expectedAmountCents: order.totalCents, status: "PENDENTE" }); return { checkoutUrl: input.successUrl, expiresAt: order.expiresAt, orderNumber: order.orderNumber }; }
  async consultarPedido(orderNumber: string): Promise<ConsultaPedidoPublica> { const order = await this.getOrder(orderNumber); return { orderNumber: order.orderNumber, status: order.status, eventTitle: order.event?.title ?? "", session: { startsAt: order.session?.startsAt, endsAt: order.session?.endsAt }, totalCents: order.totalCents, items: [] }; }
  private async getOrder(orderNumber: string): Promise<any> { const order = await this.first<any>(this.db.select({ order: eventoPedidos, event: eventos, session: eventoSessoes }).from(eventoPedidos).innerJoin(eventos, eq(eventos.id, eventoPedidos.eventId)).innerJoin(eventoSessoes, eq(eventoSessoes.id, eventoPedidos.sessionId)).where(eq(eventoPedidos.orderNumber, orderNumber))); if (!order) throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" }); return order.order ? { ...order.order, event: order.event, session: order.session } : order; }
  async liberarReservasExpiradas(now = new Date()) { return this.db.update(eventoInventarioAssentos).set({ status: "DISPONIVEL", reservationExpiresAt: null, reservedByOrderId: null, updatedAt: now }).where(and(eq(eventoInventarioAssentos.status, "RESERVADO"), lte(eventoInventarioAssentos.reservationExpiresAt, now))); }
}
