import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, ConflictException } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import {
  and,
  eq,
  eventoAuditorias,
  eventoIngressos,
  eventoInventarioAssentos,
  eventoItensPedido,
  eventoPagamentos,
  eventoParticipantes,
  eventoPedidos,
  eventoReservas,
  or,
  type Database,
} from "@essencia/db";
import { DatabaseService } from "../../common/database/database.service";

type ConfirmarCheckoutInput = {
  checkoutSessionId: string;
  paymentIntentId?: string;
  amountCents: number;
  method?: "card" | "pix";
  eventOrderId?: string;
};

type FalharCheckoutInput = {
  checkoutSessionId?: string;
  paymentIntentId?: string;
  reason: string;
  eventOrderId?: string;
};

@Injectable()
export class EventosPagamentosService {
  constructor(private readonly database: DatabaseService) {
    if (!process.env.EVENTOS_QR_SECRET) {
      throw new Error("EVENTOS_QR_SECRET não configurada no ambiente");
    }
  }

  private get db(): Database {
    return this.database.db;
  }

  private async first<T>(query: any): Promise<T | undefined> {
    const rows = await query;
    return rows?.[0];
  }

  private paymentWhere(checkoutSessionId?: string, paymentIntentId?: string) {
    const predicates = [
      checkoutSessionId
        ? eq(eventoPagamentos.stripeCheckoutSessionId, checkoutSessionId)
        : undefined,
      paymentIntentId
        ? eq(eventoPagamentos.stripePaymentIntentId, paymentIntentId)
        : undefined,
    ].filter(Boolean) as any[];
    if (predicates.length === 0) {
      throw new BadRequestException({
        code: "PAYMENT_REFERENCE_REQUIRED",
        message: "Referência de pagamento obrigatória",
      });
    }
    return predicates.length === 1 ? predicates[0] : or(...predicates);
  }

  private async findPayment(
    db: any,
    checkoutSessionId?: string,
    paymentIntentId?: string,
    eventOrderId?: string,
  ): Promise<{ payment: any; order: any } | undefined> {
    if (typeof db?.select !== "function") return undefined;
    let row = await this.first<any>(
      db
        .select({ payment: eventoPagamentos, order: eventoPedidos })
        .from(eventoPagamentos)
        .innerJoin(eventoPedidos, eq(eventoPedidos.id, eventoPagamentos.orderId))
        .where(this.paymentWhere(checkoutSessionId, paymentIntentId)),
    );
    if (!row && eventOrderId) {
      row = await this.first<any>(
        db
          .select({ payment: eventoPagamentos, order: eventoPedidos })
          .from(eventoPagamentos)
          .innerJoin(eventoPedidos, eq(eventoPedidos.id, eventoPagamentos.orderId))
          .where(eq(eventoPedidos.id, eventOrderId)),
      );
    }
    if (!row) return undefined;
    return {
      payment: row.payment ?? row.eventoPagamentos ?? row,
      order: row.order ?? row.eventoPedidos ?? row,
    };
  }

  private assertAmount(payment: any, order: any, amountCents: number) {
    const expected = payment.expectedAmountCents ?? order.totalCents;
    if (!Number.isInteger(amountCents) || amountCents !== expected) {
      throw new BadRequestException({
        code: "PAYMENT_AMOUNT_MISMATCH",
        message: "Valor do pagamento divergente do pedido",
      });
    }
  }

  private token(orderNumber: string, itemId: string) {
    const nonce = randomBytes(18).toString("base64url");
    const payload = `${orderNumber}:${itemId}:${nonce}`;
    const secret = process.env.EVENTOS_QR_SECRET;
    if (!secret) throw new InternalServerErrorException({ code: "EVENTOS_QR_SECRET_MISSING", message: "Configuração de ingressos indisponível" });
    const signature = createHmac("sha256", secret).update(payload).digest("base64url");
    return { signedToken: `${payload}.${signature}`, qrPayload: `evento:${payload}.${signature}` };
  }

  async confirmarCheckout(input: ConfirmarCheckoutInput): Promise<void> {
    const reference = await this.findPayment(
      this.db,
      input.checkoutSessionId,
      input.paymentIntentId,
      input.eventOrderId,
    );
    if (!reference) throw new NotFoundException({ code: "EVENT_ORDER_NOT_FOUND", message: "Pedido de Evento não encontrado" });
    this.assertAmount(reference.payment, reference.order, input.amountCents);

    await this.db.transaction(async (tx: any) => {
      const current =
        (await this.findPayment(tx, input.checkoutSessionId, input.paymentIntentId, input.eventOrderId)) ??
        reference;
      const payment = current.payment;
      const order = current.order;
      this.assertAmount(payment, order, input.amountCents);

      if (["CONFIRMADO", "USADO"].includes(order.status) || payment.status === "APROVADO") {
        return;
      }
      if (["CANCELADO", "EXPIRADO", "REEMBOLSADO"].includes(order.status)) {
        throw new BadRequestException({ code: "EVENT_ORDER_NOT_PAYABLE", message: "Pedido de Evento não pode ser confirmado" });
      }

      const transition = typeof tx.update === "function"
        ? await tx.update(eventoPagamentos).set({ status: "PROCESSANDO", updatedAt: new Date() }).where(and(eq(eventoPagamentos.id, payment.id), eq(eventoPagamentos.status, "PENDENTE"))).returning()
        : [];
      if (!this.changed(transition)) {
        let latest = (await this.findPayment(tx, input.checkoutSessionId, input.paymentIntentId, input.eventOrderId)) ?? current;
        if (latest.payment.status === "PROCESSANDO") {
          await new Promise((resolve) => setTimeout(resolve, 0));
          latest = (await this.findPayment(tx, input.checkoutSessionId, input.paymentIntentId, input.eventOrderId)) ?? latest;
        }
        if (["CONFIRMADO", "USADO"].includes(latest.order.status) || latest.payment.status === "APROVADO") return;
        throw new ConflictException({ code: "PAYMENT_IN_PROGRESS", message: "Pagamento de Evento em processamento" });
      }

      const items = typeof tx.select === "function"
        ? await tx.select().from(eventoItensPedido).where(eq(eventoItensPedido.orderId, order.id))
        : [];

      for (const item of items) {
        const existingTicket = typeof tx.select === "function"
          ? await this.first<any>(tx.select().from(eventoIngressos).where(eq(eventoIngressos.itemId, item.id)))
          : undefined;
        if (existingTicket) continue;

        const reservation = typeof tx.select === "function"
          ? await this.first<any>(tx.select().from(eventoReservas).where(and(eq(eventoReservas.orderId, order.id), eq(eventoReservas.inventorySeatId, item.inventorySeatId), eq(eventoReservas.status, "ATIVA"))))
          : undefined;
        if (!reservation) throw new ConflictException({ code: "RESERVATION_NOT_ACTIVE", message: "Reserva de assento não está ativa" });
        const inventory = typeof tx.select === "function"
          ? await this.first<any>(tx.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.id, item.inventorySeatId)))
          : undefined;
        if (!inventory || inventory.status !== "RESERVADO" || inventory.reservedByOrderId !== order.id) throw new ConflictException({ code: "SEAT_NOT_RESERVED", message: "Assento não está reservado para este pedido" });

        let participantId = item.participantId;
        if (!participantId && typeof tx.insert === "function") {
          const [participant] = await tx.insert(eventoParticipantes).values({
            eventId: order.eventId,
            orderId: order.id,
            type: "CONVIDADO",
            fullName: order.buyerName,
            email: order.buyerEmail,
            phone: order.buyerPhone,
          }).returning();
          participantId = participant?.id;
          if (participantId && typeof tx.update === "function") {
            await tx.update(eventoItensPedido).set({ participantId, updatedAt: new Date() }).where(eq(eventoItensPedido.id, item.id));
          }
        }
        if (!participantId) throw new BadRequestException({ code: "PARTICIPANT_REQUIRED", message: "Participante obrigatório para emitir ingresso" });

        const sold = await tx.update(eventoInventarioAssentos).set({ status: "VENDIDO", soldAt: new Date(), reservationExpiresAt: null, reservedByOrderId: null, updatedAt: new Date() }).where(and(eq(eventoInventarioAssentos.id, item.inventorySeatId), eq(eventoInventarioAssentos.status, "RESERVADO"), eq(eventoInventarioAssentos.reservedByOrderId, order.id))).returning();
        if (!this.changed(sold)) throw new ConflictException({ code: "SEAT_STATE_CHANGED", message: "Estado do assento mudou durante a confirmação" });
        const converted = await tx.update(eventoReservas).set({ status: "CONVERTIDA", updatedAt: new Date() }).where(and(eq(eventoReservas.id, reservation.id), eq(eventoReservas.status, "ATIVA"))).returning();
        if (!this.changed(converted)) throw new ConflictException({ code: "RESERVATION_STATE_CHANGED", message: "Estado da reserva mudou durante a confirmação" });
        if (typeof tx.insert === "function") {
          const token = this.token(order.orderNumber, item.id);
          await tx.insert(eventoIngressos).values({ orderId: order.id, itemId: item.id, sessionId: order.sessionId, inventorySeatId: item.inventorySeatId, participantId, status: "EMITIDO", ...token }).returning();
        }
      }

      if (typeof tx.update === "function") {
        await tx.update(eventoPagamentos).set({ status: "APROVADO", method: input.method ?? payment.method ?? "card", receivedAmountCents: input.amountCents, stripeCheckoutSessionId: input.checkoutSessionId || payment.stripeCheckoutSessionId, stripePaymentIntentId: input.paymentIntentId || payment.stripePaymentIntentId, processedAt: new Date(), updatedAt: new Date() }).where(eq(eventoPagamentos.id, payment.id)).returning();
        await tx.update(eventoPedidos).set({ status: "CONFIRMADO", confirmedAt: new Date(), updatedAt: new Date() }).where(eq(eventoPedidos.id, order.id)).returning();
      }
      if (typeof tx.insert === "function" && order.eventId && payment.id) {
        await tx.insert(eventoAuditorias).values({ eventId: order.eventId, action: "CONFIRMADO", resourceType: "pagamento", resourceId: payment.id, metadata: { checkoutSessionId: input.checkoutSessionId || null, paymentIntentId: input.paymentIntentId || null, amountCents: input.amountCents } });
      }
    });
  }

  private changed(result: any): boolean {
    if (Array.isArray(result)) return result.length === 1;
    if (typeof result?.rowCount === "number") return result.rowCount === 1;
    return false;
  }

  async falharCheckout(input: FalharCheckoutInput): Promise<void> {
    const reference = await this.findPayment(this.db, input.checkoutSessionId, input.paymentIntentId, input.eventOrderId);
    if (!reference) return;

    await this.db.transaction(async (tx: any) => {
      const current = (await this.findPayment(tx, input.checkoutSessionId, input.paymentIntentId, input.eventOrderId)) ?? reference;
      const payment = current.payment;
      const order = current.order;
      if (["CONFIRMADO", "USADO"].includes(order.status) || payment.status === "APROVADO") return;

      const reservations = typeof tx.select === "function"
        ? await tx.select().from(eventoReservas).where(and(eq(eventoReservas.orderId, order.id), eq(eventoReservas.status, "ATIVA")))
        : [];
      for (const reservation of reservations) {
        const released = await tx.update(eventoInventarioAssentos).set({ status: "DISPONIVEL", reservationExpiresAt: null, reservedByOrderId: null, updatedAt: new Date() }).where(and(eq(eventoInventarioAssentos.id, reservation.inventorySeatId), eq(eventoInventarioAssentos.status, "RESERVADO"), eq(eventoInventarioAssentos.reservedByOrderId, order.id))).returning();
        if (!this.changed(released)) throw new ConflictException({ code: "SEAT_STATE_CHANGED", message: "Estado do assento mudou durante a falha" });
        const releasedReservation = await tx.update(eventoReservas).set({ status: "LIBERADA", releasedAt: new Date(), updatedAt: new Date() }).where(and(eq(eventoReservas.id, reservation.id), eq(eventoReservas.status, "ATIVA"))).returning();
        if (!this.changed(releasedReservation)) throw new ConflictException({ code: "RESERVATION_STATE_CHANGED", message: "Estado da reserva mudou durante a falha" });
      }
      if (typeof tx.update === "function") {
        await tx.update(eventoPagamentos).set({ status: input.reason.toLowerCase().includes("expir") ? "EXPIRADO" : "RECUSADO", processedAt: new Date(), updatedAt: new Date() }).where(eq(eventoPagamentos.id, payment.id)).returning();
        await tx.update(eventoPedidos).set({ status: "CANCELADO", cancelledAt: new Date(), cancellationReason: input.reason, updatedAt: new Date() }).where(and(eq(eventoPedidos.id, order.id), eq(eventoPedidos.status, order.status))).returning();
      }
      if (typeof tx.insert === "function" && order.eventId && payment.id) {
        await tx.insert(eventoAuditorias).values({ eventId: order.eventId, action: "CANCELADO", resourceType: "pagamento", resourceId: payment.id, reason: "checkout_failed" });
      }
    });
  }
}
