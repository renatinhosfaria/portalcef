import { ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { and, eq, eventoAuditorias, eventoIngressos, eventoInventarioAssentos, eventoItensPedido, eventoPagamentos, eventoParticipantes, eventoPedidos, eventoReservas, type Database } from "@essencia/db";
import { gerarNumeroIngresso } from "@essencia/shared/eventos/ingresso";
import { EventosCuponsService } from "./eventos-cupons.service";
import { gerarTokenIngresso } from "./token-ingresso";

export type OrigemConfirmacao = "STRIPE" | "CORTESIA_100";

@Injectable()
export class EventosConfirmacaoService {
  constructor(@Optional() private readonly cuponsService?: EventosCuponsService) {}

  private async first<T>(query: any): Promise<T | undefined> {
    const rows = await query;
    return rows?.[0];
  }

  private lockRows<T>(query: T): T {
    return typeof (query as any)?.for === "function" ? (query as any).for("update") : query;
  }

  private changed(result: any): boolean {
    if (Array.isArray(result)) return result.length === 1;
    if (typeof result?.rowCount === "number") return result.rowCount === 1;
    return false;
  }

  async confirmarPedido(orderId: string, origem: OrigemConfirmacao, db: Database): Promise<void> {
    const orderQuery = db.select().from(eventoPedidos).where(eq(eventoPedidos.id, orderId));
    const order = await this.first<any>((db as any).__eventosLocksHeld ? orderQuery : this.lockRows(orderQuery));
    if (!order) throw new NotFoundException({ code: "EVENT_ORDER_NOT_FOUND", message: "Pedido de Evento não encontrado" });
    if (["CONFIRMADO", "USADO"].includes(order.status)) return;
    if (["CANCELADO", "EXPIRADO", "REEMBOLSADO"].includes(order.status)) {
      throw new ConflictException({ code: "EVENT_ORDER_NOT_PAYABLE", message: "Pedido de Evento não pode ser confirmado" });
    }

    const payment = typeof db.select === "function" ? await this.first<any>(db.select().from(eventoPagamentos).where(eq(eventoPagamentos.orderId, order.id))) : undefined;
    const locksAlreadyHeld = (db as any).__eventosLocksHeld === true || (payment && ["PROCESSANDO", "APROVADO"].includes(payment.status));

    const items = typeof db.select === "function" ? await db.select().from(eventoItensPedido).where(eq(eventoItensPedido.orderId, order.id)) : [];
    const itensOrdenados = [...items].sort((left: any, right: any) => String(left.inventorySeatId).localeCompare(String(right.inventorySeatId)) || String(left.id).localeCompare(String(right.id)));

    if (!locksAlreadyHeld) for (const item of itensOrdenados) {
      await this.first<any>(this.lockRows(db.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.id, item.inventorySeatId))));
      await this.first<any>(this.lockRows(db.select().from(eventoReservas).where(and(eq(eventoReservas.orderId, order.id), eq(eventoReservas.inventorySeatId, item.inventorySeatId), eq(eventoReservas.status, "ATIVA")))));
    }

    for (const item of itensOrdenados) {
      const existingTicket = await this.first<any>(db.select().from(eventoIngressos).where(eq(eventoIngressos.itemId, item.id)));
      if (existingTicket) continue;

      const reservation = await this.first<any>(db.select().from(eventoReservas).where(and(eq(eventoReservas.orderId, order.id), eq(eventoReservas.inventorySeatId, item.inventorySeatId), eq(eventoReservas.status, "ATIVA"))));
      if (!reservation) throw new ConflictException({ code: "RESERVATION_NOT_ACTIVE", message: "Reserva de assento não está ativa" });
      const inventory = await this.first<any>(db.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.id, item.inventorySeatId)));
      if (!inventory || inventory.status !== "RESERVADO" || inventory.reservedByOrderId !== order.id) throw new ConflictException({ code: "SEAT_NOT_RESERVED", message: "Assento não está reservado para este pedido" });

      let participantId = item.participantId;
      if (!participantId && typeof db.insert === "function") {
        const [participant] = await db.insert(eventoParticipantes).values({ eventId: order.eventId, orderId: order.id, type: "CONVIDADO", fullName: order.buyerName, email: order.buyerEmail, phone: order.buyerPhone }).returning();
        participantId = participant?.id;
        if (participantId && typeof db.update === "function") await db.update(eventoItensPedido).set({ participantId, updatedAt: new Date() }).where(eq(eventoItensPedido.id, item.id));
      }
      if (!participantId) throw new ConflictException({ code: "PARTICIPANT_REQUIRED", message: "Participante obrigatório para emitir ingresso" });

      const sold = await db.update(eventoInventarioAssentos).set({ status: "VENDIDO", soldAt: new Date(), reservationExpiresAt: null, reservedByOrderId: null, updatedAt: new Date() }).where(and(eq(eventoInventarioAssentos.id, item.inventorySeatId), eq(eventoInventarioAssentos.status, "RESERVADO"), eq(eventoInventarioAssentos.reservedByOrderId, order.id))).returning();
      if (!this.changed(sold)) throw new ConflictException({ code: "SEAT_STATE_CHANGED", message: "Estado do assento mudou durante a confirmação" });
      const converted = await db.update(eventoReservas).set({ status: "CONVERTIDA", updatedAt: new Date() }).where(and(eq(eventoReservas.id, reservation.id), eq(eventoReservas.status, "ATIVA"))).returning();
      if (!this.changed(converted)) throw new ConflictException({ code: "RESERVATION_STATE_CHANGED", message: "Estado da reserva mudou durante a confirmação" });
      await db.insert(eventoIngressos).values({ numero: gerarNumeroIngresso(), orderId: order.id, itemId: item.id, sessionId: order.sessionId, inventorySeatId: item.inventorySeatId, participantId, status: "EMITIDO", ...gerarTokenIngresso(order.orderNumber, item.id) }).returning();
    }

    await db.update(eventoPedidos).set({ status: "CONFIRMADO", confirmedAt: new Date(), updatedAt: new Date() }).where(eq(eventoPedidos.id, order.id)).returning();
    if (typeof db.insert === "function" && order.eventId) {
      await db.insert(eventoAuditorias).values({ eventId: order.eventId, action: "CONFIRMADO", resourceType: payment ? "pagamento" : "pedido", resourceId: payment?.id ?? order.id, metadata: { origem } }).returning();
    }
    if (this.cuponsService) await this.cuponsService.confirmarUso(order.id, db);
  }
}
