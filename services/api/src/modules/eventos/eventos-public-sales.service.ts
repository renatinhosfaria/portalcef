import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException, forwardRef } from "@nestjs/common";
import { and, desc, eq, eventoAceites, eventoInventarioAssentos, eventoItensPedido, eventoMapaAssentos, eventoOfertas, eventoPagamentos, eventoParticipantes, eventoPedidos, eventoPoliticas, eventoReservas, eventoSessoes, eventoTiposIngresso, eventoTokensConsulta, eventos, inArray, lte, type Database } from "@essencia/db";
import { checkoutPublicoSchema, finalizarPedidoSchema, reservaPublicaSchema, type CheckoutPublicoInput, type FinalizarPedidoInput, type ReservaPublicaInput } from "@essencia/shared/schemas";
import { calcularPrecoPedido, type OfertaPreco } from "@essencia/shared/eventos/precos";
import type { ConsultaPedidoPublica, FinalizacaoPublicaResult, PedidoPublicoResult, PoliticaPublica, ReservaPublicaResult } from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";
import { PaymentsService } from "../payments/payments.service";
import { gerarTokenAcesso, validadeAcesso } from "./acesso-pedido";

const fail = (code: string, message: string) => new BadRequestException({ code, message });
const validated = <T>(schema: { safeParse(value: unknown): { success: boolean; data?: T } }, value: unknown): T => { const result = schema.safeParse(value); if (!result.success) throw fail("VALIDATION_ERROR", "Dados inválidos"); return result.data as T; };

@Injectable()
export class EventosPublicSalesService {
  constructor(private readonly database: DatabaseService, @Inject(forwardRef(() => PaymentsService)) private readonly paymentsService: PaymentsService = undefined as never) {}
  private get db(): Database { return this.database.db; }
  private async first<T>(query: any): Promise<T | undefined> { const rows = await query; return rows?.[0]; }
  private async lockRows<T>(query: any): Promise<T> { return typeof query?.for === "function" ? query.for("update") : query; }
  private normalizePhone(phone: string) { return phone.replace(/\D/g, "").slice(0, 30); }
  private orderNumber() { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""); }

  async listarPoliticasPublicas(slug: string): Promise<PoliticaPublica[]> { const event = await this.first<any>(this.db.select().from(eventos).where(and(eq(eventos.slug, slug), eq(eventos.status, "PUBLICADO")))); if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" }); const rows = await this.db.select().from(eventoPoliticas).where(and(eq(eventoPoliticas.eventId, event.id), eq(eventoPoliticas.active, true))).orderBy(desc(eventoPoliticas.version)); const latest = new Map<string, PoliticaPublica>(); for (const row of rows) if (!latest.has(row.type)) latest.set(row.type, { type: row.type as PoliticaPublica["type"], version: row.version, content: row.content }); return [...latest.values()]; }

  async reservarAssentos(raw: unknown): Promise<ReservaPublicaResult> {
    const input = validated<ReservaPublicaInput>(reservaPublicaSchema, raw);
    const assentos = input.seats.map((seat) => seat.seatId);
    if (new Set(assentos).size !== assentos.length) {
      throw fail("DUPLICATE_SEAT", "Não é permitido reservar o mesmo assento duas vezes");
    }
    const participantes = input.seats.map((seat) => seat.participantIndex);
    if (
      new Set(participantes).size !== participantes.length ||
      participantes.some((index, position) => index < 0 || index >= input.seats.length || !participantes.includes(position))
    ) {
      throw fail("VALIDATION_ERROR", "Participantes devem corresponder aos assentos");
    }
    const executar = async (tx: any) => {
      const existing = await this.first<any>(tx.select().from(eventoPedidos).where(eq(eventoPedidos.idempotencyKey, input.idempotencyKey)));
      if (existing) {
        if (!(await this.reservaIdempotenteCompativel(tx, existing, input.sessionId, assentos))) {
          throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Chave de idempotência já utilizada" });
        }
        return this.reservaResult(tx, existing);
      }

      const joinedQuery = tx.select().from(eventos).innerJoin(eventoSessoes, eq(eventoSessoes.eventId, eventos.id)).where(and(eq(eventoSessoes.id, input.sessionId), eq(eventos.status, "PUBLICADO"), eq(eventoSessoes.status, "PUBLICADA")));
      const joined = await this.first<any>(await this.lockRows(joinedQuery));
      const event = joined?.event ?? joined?.eventos ?? joined;
      const session = joined?.session ?? joined?.evento_sessoes;
      if (!event || !session) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento ou sessão não encontrados" });
      const now = new Date();
      if ((session.salesStartsAt && now < session.salesStartsAt) || (session.salesEndsAt && now >= session.salesEndsAt)) {
        throw fail("EVENT_NOT_FOUND", "Sessão fora do período de vendas");
      }

      const requestedQuantities = new Map<string, number>();
      for (const requested of input.seats) requestedQuantities.set(requested.ticketTypeId, (requestedQuantities.get(requested.ticketTypeId) ?? 0) + 1);
      const ticketById = new Map<string, any>();
      for (const [ticketTypeId, quantity] of requestedQuantities) {
        const ticketQuery = tx.select().from(eventoTiposIngresso).where(and(eq(eventoTiposIngresso.id, ticketTypeId), eq(eventoTiposIngresso.eventId, event.id), eq(eventoTiposIngresso.active, true)));
        const ticket = await this.first<any>(await this.lockRows(ticketQuery));
        if (!ticket) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Ingresso não encontrado" });
        if (ticket.maxPerOrder !== null && ticket.maxPerOrder !== undefined && quantity > ticket.maxPerOrder) {
          throw fail("TICKET_LIMIT_EXCEEDED", "Limite de ingressos por pedido excedido");
        }
        ticketById.set(ticketTypeId, ticket);
      }

      const selected: Array<{ inventory: any; ticket: any; requested: ReservaPublicaInput["seats"][number] }> = [];
      for (const requested of input.seats) {
        const inventoryQuery = tx.select().from(eventoInventarioAssentos).where(and(eq(eventoInventarioAssentos.sessionId, input.sessionId), eq(eventoInventarioAssentos.seatId, requested.seatId)));
        const inventory = await this.first<any>(await this.lockRows(inventoryQuery));
        if (!inventory || !["DISPONIVEL", "LIBERADO", "RESERVADO"].includes(inventory.status)) {
          throw new ConflictException({ code: "SEAT_UNAVAILABLE", message: "Assento indisponível" });
        }
        if (inventory.status === "RESERVADO" && (!inventory.reservationExpiresAt || inventory.reservationExpiresAt > now)) {
          throw new ConflictException({ code: "SEAT_UNAVAILABLE", message: "Assento indisponível" });
        }
        selected.push({ inventory, ticket: ticketById.get(requested.ticketTypeId), requested });
      }

      const rawOffers = await this.lockRows<any[]>(tx.select().from(eventoOfertas).where(and(eq(eventoOfertas.eventId, event.id), eq(eventoOfertas.active, true))));
      const activeOffers = rawOffers.filter((candidate: any) => candidate.active);
      if (activeOffers.length > 1) {
        throw new ConflictException({ code: "MULTIPLE_ACTIVE_OFFERS", message: "Mais de uma oferta ativa para o evento" });
      }
      const offers: OfertaPreco[] = activeOffers
        .filter((candidate: any) => {
          const quantity = selected.length;
          const inRange = quantity >= candidate.minQuantity && (candidate.maxQuantity === null || candidate.maxQuantity === undefined || quantity <= candidate.maxQuantity);
          if (!inRange) return false;
          if (candidate.pricingType === "PERCENTUAL") return true;
          const compatible = candidate.compatibleTicketTypeIds as string[] | null | undefined;
          return !compatible || selected.every((item) => compatible.includes(item.ticket.id));
        })
        .map((candidate: any) => ({
          id: candidate.id,
          version: candidate.version,
          name: candidate.name,
          pricingType: candidate.pricingType,
          minQuantity: candidate.minQuantity,
          maxQuantity: candidate.maxQuantity ?? null,
          priceCents: candidate.priceCents ?? null,
          discountPercent: candidate.discountPercent ?? null,
          active: candidate.active,
        }));
      const preco = calcularPrecoPedido({
        items: selected.map((item) => ({ seatId: item.requested.seatId, ticketTypeId: item.ticket.id, participantIndex: item.requested.participantIndex, basePriceCents: item.ticket.priceCents })),
        offers,
      });
      if (preco.totalCents < 100) throw fail("INVALID_AMOUNT", "Valor mínimo para pagamento: R$ 1,00");

      const expiresAt = new Date(now.getTime() + 15 * 60_000);
      // Só depois de todas as validações e do cálculo final liberamos reservas expiradas.
      for (const item of selected) {
        if (item.inventory.status === "RESERVADO") {
          await tx.update(eventoInventarioAssentos).set({ status: "DISPONIVEL", reservationExpiresAt: null, reservedByOrderId: null, updatedAt: now }).where(and(eq(eventoInventarioAssentos.id, item.inventory.id), eq(eventoInventarioAssentos.status, "RESERVADO"), lte(eventoInventarioAssentos.reservationExpiresAt, now)));
        }
      }

      let order: any;
      const valoresPedido = {
        eventId: event.id,
        sessionId: input.sessionId,
        orderNumber: this.orderNumber(),
        buyerName: null,
        buyerEmail: null,
        buyerPhone: null,
        status: "INICIADO",
        subtotalCents: preco.subtotalCents,
        discountCents: preco.discountCents,
        appliedOfferId: preco.appliedOffer?.id ?? null,
        totalCents: preco.totalCents,
        idempotencyKey: input.idempotencyKey,
        expiresAt,
      };
      [order] = await tx.insert(eventoPedidos).values(valoresPedido).returning();
      if (!order) throw new ConflictException({ code: "ORDER_NOT_CREATED", message: "Não foi possível criar o pedido" });
      order = { ...valoresPedido, ...order, subtotalCents: order.subtotalCents ?? preco.subtotalCents, discountCents: order.discountCents ?? preco.discountCents, appliedOfferId: order.appliedOfferId ?? preco.appliedOffer?.id ?? null, totalCents: order.totalCents ?? preco.totalCents };

      for (const item of selected) {
        const indice = preco.items.findIndex((price) => price.seatId === item.requested.seatId);
        const price = preco.items[indice]!;
        const updateQuery = tx.update(eventoInventarioAssentos).set({ status: "RESERVADO", reservationExpiresAt: expiresAt, reservedByOrderId: order.id, updatedAt: now }).where(and(eq(eventoInventarioAssentos.id, item.inventory.id), eq(eventoInventarioAssentos.status, item.inventory.status === "RESERVADO" ? "DISPONIVEL" : item.inventory.status)));
        const updated = typeof updateQuery.returning === "function" ? await updateQuery.returning() : await updateQuery;
        if (Array.isArray(updated) && !updated.length) throw new ConflictException({ code: "SEAT_UNAVAILABLE", message: "Assento indisponível" });
        await tx.insert(eventoReservas).values({ orderId: order.id, inventorySeatId: item.inventory.id, idempotencyKey: `${input.idempotencyKey}:${item.requested.seatId}`, status: "ATIVA", expiresAt });
        await tx.insert(eventoItensPedido).values({ orderId: order.id, inventorySeatId: item.inventory.id, ticketTypeId: item.ticket.id, quantity: 1, unitPriceCents: price.unitPriceCents, totalPriceCents: price.totalPriceCents, pricingEvidence: { source: preco.appliedOffer ? "eventoOfertas" : "eventoTiposIngresso", baseUnitPriceCents: price.baseUnitPriceCents, allocatedDiscountCents: price.allocatedDiscountCents, offerId: preco.appliedOffer?.id ?? null, offerVersion: preco.appliedOffer?.version ?? null, offerSnapshot: preco.appliedOffer, ticketTypeVersion: item.ticket.version, participantIndex: item.requested.participantIndex, seatId: item.requested.seatId, allocationMethod: "MAIOR_RESTO" } });
      }
      return this.reservaResult(tx, order);
    };

    return (this.db as any).transaction ? this.db.transaction(executar).catch(async (error: any) => {
      if (error?.code === "23505" || error?.constraint?.includes("idempotency")) {
        const existing = await this.first<any>(this.db.select().from(eventoPedidos).where(eq(eventoPedidos.idempotencyKey, input.idempotencyKey)));
        if (existing) {
          if (!(await this.reservaIdempotenteCompativel(this.db, existing, input.sessionId, assentos))) {
            throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Chave de idempotência já utilizada" });
          }
          return this.reservaResult(this.db, existing);
        }
      }
      throw error;
    }) : executar(this.db);
  }

  private async reservaIdempotenteCompativel(db: any, order: any, sessionId: string, seatIds: string[]): Promise<boolean> {
    if (order.sessionId && order.sessionId !== sessionId) return false;
    const rows = await db.select({ inventory: eventoInventarioAssentos }).from(eventoItensPedido).innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.id, eventoItensPedido.inventorySeatId)).where(eq(eventoItensPedido.orderId, order.id));
    if (!rows.length) return false;
    const persisted = rows.map((row: any) => row.inventory?.seatId).filter(Boolean).sort();
    return persisted.length === seatIds.length && persisted.every((seatId: string, index: number) => seatId === [...seatIds].sort()[index]);
  }

  private async reservaResult(db: any, order: any): Promise<ReservaPublicaResult> {
    const rows = await db.select({ item: eventoItensPedido, inventory: eventoInventarioAssentos }).from(eventoItensPedido).innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.id, eventoItensPedido.inventorySeatId)).where(eq(eventoItensPedido.orderId, order.id));
    const snapshot = order.appliedOffer ?? rows.find((row: any) => row.item?.pricingEvidence?.offerSnapshot)?.item?.pricingEvidence?.offerSnapshot ?? null;
    return {
      reservationId: order.id,
      orderNumber: order.orderNumber,
      expiresAt: order.expiresAt,
      subtotalCents: order.subtotalCents ?? order.totalCents,
      discountCents: order.discountCents ?? 0,
      totalCents: order.totalCents,
      appliedOffer: snapshot,
      items: rows.map((row: any) => ({ seatId: row.inventory?.seatId, ticketTypeId: row.item?.ticketTypeId, unitPriceCents: row.item?.unitPriceCents, totalPriceCents: row.item?.totalPriceCents })),
    };
  }

  async finalizarPedidoConvidado(orderNumber: string, raw: unknown): Promise<FinalizacaoPublicaResult> {
    const input = validated<FinalizarPedidoInput>(finalizarPedidoSchema, raw);
    const types = ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"];
    if (new Set(input.acceptances.map((a) => a.type)).size !== 5 || types.some((type) => !input.acceptances.some((a) => a.type === type))) throw fail("VALIDATION_ERROR", "Aceites completos obrigatórios");
    const indexes = input.participants.map((p) => p.participantIndex);
    if (new Set(indexes).size !== indexes.length || indexes.some((index) => index < 0 || index >= input.participants.length) || indexes.some((_, index) => !indexes.includes(index))) throw fail("VALIDATION_ERROR", "Índices de participantes inválidos");
    return this.db.transaction(async (tx: any) => {
      const order = await this.getOrder(orderNumber, tx);
      const prior = await this.first<any>(tx.select().from(eventoPedidos).where(eq(eventoPedidos.finalizationIdempotencyKey, input.idempotencyKey)));
      if (prior) { if (prior.id !== order.id) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Chave de idempotência já utilizada" }); return this.finalizacaoResult(order, tx); }
      if (!["INICIADO", "RESERVADO"].includes(order.status) || (order.expiresAt && order.expiresAt <= new Date())) throw fail("ORDER_NOT_AVAILABLE", "Pedido expirado ou indisponível");
      if (order.finalizationIdempotencyKey && order.finalizationIdempotencyKey !== input.idempotencyKey) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Pedido já finalizado com outra chave" });
      const buyer = { name: input.buyer.name.trim(), email: input.buyer.email.trim().toLowerCase(), phone: this.normalizePhone(input.buyer.phone) };
      const policies = await tx.select().from(eventoPoliticas).where(and(eq(eventoPoliticas.eventId, order.eventId), eq(eventoPoliticas.active, true)));
      for (const acceptance of input.acceptances) { const policy = policies.find((p: any) => p.type === acceptance.type && p.version === acceptance.version); if (!policy) throw fail("POLICY_VERSION_MISMATCH", "Versão de política inválida"); await tx.insert(eventoAceites).values({ orderId: order.id, type: acceptance.type, policyId: policy.id, policyVersion: policy.version, acceptedByName: buyer.name, acceptedByEmail: buyer.email }); }
      const items = await tx.select().from(eventoItensPedido).where(eq(eventoItensPedido.orderId, order.id));
      if (items.length !== input.participants.length) throw fail("VALIDATION_ERROR", "Participantes devem corresponder aos itens");
      for (const participant of input.participants) { const [created] = await tx.insert(eventoParticipantes).values({ eventId: order.eventId, orderId: order.id, type: participant.type, fullName: participant.fullName, email: participant.email ?? null, phone: participant.phone ?? null }).returning(); const item = items.find((candidate: any) => candidate.pricingEvidence?.participantIndex === participant.participantIndex); if (!item) throw fail("VALIDATION_ERROR", "Participante sem item correspondente"); if (created) await tx.update(eventoItensPedido).set({ participantId: created.id, updatedAt: new Date() }).where(eq(eventoItensPedido.id, item.id)); }
      await tx.update(eventoPedidos).set({ buyerName: buyer.name, buyerEmail: buyer.email, buyerPhone: buyer.phone, status: "RESERVADO", finalizationIdempotencyKey: input.idempotencyKey, updatedAt: new Date() }).where(eq(eventoPedidos.id, order.id));
      const finalizado = { ...order, ...buyer, buyerName: buyer.name, buyerEmail: buyer.email, buyerPhone: buyer.phone, status: "RESERVADO", finalizationIdempotencyKey: input.idempotencyKey };
      return this.finalizacaoResult(finalizado, tx);
    }).catch(async (error: any) => { if (error?.code === "23505" || error?.constraint?.includes("finalization")) { const existing = await this.first<any>(this.db.select().from(eventoPedidos).where(eq(eventoPedidos.finalizationIdempotencyKey, input.idempotencyKey))); const ownOrder = await this.getOrder(orderNumber, this.db); if (existing?.id === ownOrder.id) return this.finalizacaoResult(ownOrder, this.db); throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Chave de idempotência já utilizada" }); } throw error; });
  }

  private async finalizacaoResult(order: any, db: any): Promise<FinalizacaoPublicaResult> {
    const pedido = await this.pedidoResult(order, db);
    const { token, hash } = gerarTokenAcesso();
    const expiresAt = validadeAcesso(order.session?.endsAt ?? order.session?.startsAt);
    await db.insert(eventoTokensConsulta).values({ orderId: order.id, email: order.buyerEmail, tokenHash: hash, expiresAt });
    return { pedido, acesso: token };
  }

  async iniciarCheckout(orderNumber: string, raw: unknown) {
    const input = validated<CheckoutPublicoInput>(checkoutPublicoSchema, raw);
    if (!this.paymentsService) throw new ServiceUnavailableException({ code: "CHECKOUT_UNAVAILABLE", message: "Checkout ainda indisponível" });
    this.validarUrlCheckout(input.successUrl);
    this.validarUrlCheckout(input.cancelUrl);
    const order = await this.getOrder(orderNumber, this.db);
    if (!["RESERVADO", "AGUARDANDO_PAGAMENTO"].includes(order.status)) throw fail("ORDER_NOT_AVAILABLE", "Pedido indisponível para checkout");
    if (order.expiresAt && order.expiresAt <= new Date()) throw fail("ORDER_NOT_AVAILABLE", "Pedido expirado ou indisponível");
    const minimumCheckoutExpiry = new Date(Date.now() + 30 * 60_000);
    const checkoutExpiresAt = order.expiresAt && order.expiresAt > minimumCheckoutExpiry ? order.expiresAt : minimumCheckoutExpiry;
    const rows = await this.db.select({ item: eventoItensPedido, ticket: eventoTiposIngresso }).from(eventoItensPedido).innerJoin(eventoTiposIngresso, eq(eventoTiposIngresso.id, eventoItensPedido.ticketTypeId)).where(eq(eventoItensPedido.orderId, order.id));
    if (!rows.length) throw fail("ORDER_NOT_AVAILABLE", "Pedido sem itens");
    const items = rows.map((row: any) => {
      const unitAmount = row.item?.unitPriceCents;
      const quantity = row.item?.quantity;
      if (!Number.isInteger(unitAmount) || unitAmount < 0 || !Number.isInteger(quantity) || quantity < 1) {
        throw fail("CHECKOUT_AMOUNT_MISMATCH", "Preços persistidos do pedido inválidos");
      }
      return { name: row.ticket?.name ?? "Ingresso de Evento", unitAmount, quantity };
    });
    const linesTotalCents = items.reduce((total: number, item: { unitAmount: number; quantity: number }) => total + item.unitAmount * item.quantity, 0);
    if (linesTotalCents !== order.totalCents) throw fail("CHECKOUT_AMOUNT_MISMATCH", "Linhas do checkout não fecham o total do pedido");
    const checkout = await this.paymentsService.createCheckoutSession({
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalCents,
      customerName: order.buyerName,
      customerPhone: order.buyerPhone,
      customerEmail: order.buyerEmail,
      expiresAt: checkoutExpiresAt,
      items,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      idempotencyKey: `evento-checkout:${order.id}`,
      eventOrderId: order.id,
    });
    const existing = await this.first<any>(this.db.select().from(eventoPagamentos).where(eq(eventoPagamentos.orderId, order.id)));
    if (existing) {
      await this.db.update(eventoPagamentos).set({ stripeCheckoutSessionId: checkout.checkoutSessionId, stripePaymentIntentId: checkout.paymentIntentId ?? null, expectedAmountCents: linesTotalCents, status: "PENDENTE", updatedAt: new Date() }).where(eq(eventoPagamentos.id, existing.id));
    } else {
      await this.db.insert(eventoPagamentos).values({ orderId: order.id, stripeCheckoutSessionId: checkout.checkoutSessionId, stripePaymentIntentId: checkout.paymentIntentId ?? null, method: "card", expectedAmountCents: linesTotalCents, receivedAmountCents: null, currency: "BRL", status: "PENDENTE" });
    }
    await this.db.update(eventoPedidos).set({ status: "AGUARDANDO_PAGAMENTO", expiresAt: checkoutExpiresAt, updatedAt: new Date() }).where(and(eq(eventoPedidos.id, order.id), inArray(eventoPedidos.status, ["RESERVADO", "INICIADO"] as any)));
    await this.db.update(eventoReservas).set({ expiresAt: checkoutExpiresAt, updatedAt: new Date() }).where(and(eq(eventoReservas.orderId, order.id), eq(eventoReservas.status, "ATIVA")));
    await this.db.update(eventoInventarioAssentos).set({ reservationExpiresAt: checkoutExpiresAt, updatedAt: new Date() }).where(and(eq(eventoInventarioAssentos.reservedByOrderId, order.id), eq(eventoInventarioAssentos.status, "RESERVADO")));
    return { checkoutUrl: checkout.checkoutUrl, expiresAt: checkoutExpiresAt, orderNumber: order.orderNumber };
  }
  private validarUrlCheckout(value: string) {
    const configured = (process.env.EVENTOS_PUBLIC_URL || "https://eventos.portalcef.com.br").replace(/\/$/, "");
    let url: URL;
    let origin: URL;
    try { url = new URL(value); origin = new URL(configured); } catch { throw fail("CHECKOUT_URL_NOT_ALLOWED", "URL de checkout não permitida"); }
    if (url.protocol !== "https:" || url.origin !== origin.origin) throw fail("CHECKOUT_URL_NOT_ALLOWED", "URL de checkout não permitida");
  }
  async consultarPedido(orderNumber: string, db: any = this.db): Promise<ConsultaPedidoPublica> { const order = await this.getOrder(orderNumber, db); if (order.expiresAt && order.expiresAt <= new Date() && !["CONFIRMADO", "USADO"].includes(order.status)) throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" }); return this.pedidoResult(order, db); }
  private async pedidoResult(order: any, db: any): Promise<PedidoPublicoResult> { if (order.event?.status !== "PUBLICADO" || order.session?.status !== "PUBLICADA") throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" }); const rows = await db.select({ item: eventoItensPedido, inventory: eventoInventarioAssentos, seat: eventoMapaAssentos, ticket: eventoTiposIngresso }).from(eventoItensPedido).innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.id, eventoItensPedido.inventorySeatId)).innerJoin(eventoMapaAssentos, eq(eventoMapaAssentos.id, eventoInventarioAssentos.seatId)).innerJoin(eventoTiposIngresso, eq(eventoTiposIngresso.id, eventoItensPedido.ticketTypeId)).where(eq(eventoItensPedido.orderId, order.id)); const snapshot = order.appliedOffer ?? rows.find((row: any) => row.item?.pricingEvidence?.offerSnapshot)?.item?.pricingEvidence?.offerSnapshot ?? null; return { orderNumber: order.orderNumber, status: order.status, eventTitle: order.event?.title ?? "", eventSlug: order.event?.slug ?? "", sessionId: order.session?.id ?? order.sessionId, expiresAt: order.expiresAt ?? null, session: { startsAt: order.session?.startsAt, endsAt: order.session?.endsAt }, subtotalCents: order.subtotalCents ?? order.totalCents, discountCents: order.discountCents ?? 0, totalCents: order.totalCents, appliedOffer: snapshot, items: rows.map((row: any) => ({ seatId: row.inventory?.seatId, ticketTypeId: row.item?.ticketTypeId, unitPriceCents: row.item?.unitPriceCents, totalPriceCents: row.item?.totalPriceCents, rowLabel: row.seat?.rowLabel ?? row.inventory?.rowLabel ?? "", seatNumber: row.seat?.seatNumber ?? row.inventory?.seatNumber ?? "", ticketTypeName: row.ticket?.name ?? row.item?.ticketTypeName ?? "" })) }; }
  private async getOrder(orderNumber: string, db: any): Promise<any> { const result = await this.first<any>(db.select({ order: eventoPedidos, event: eventos, session: eventoSessoes }).from(eventoPedidos).innerJoin(eventos, eq(eventos.id, eventoPedidos.eventId)).innerJoin(eventoSessoes, eq(eventoSessoes.id, eventoPedidos.sessionId)).where(eq(eventoPedidos.orderNumber, orderNumber))); if (!result) throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" }); return result.order ? { ...result.order, event: result.event, session: result.session } : result; }

  async liberarPedido(orderNumber: string): Promise<{ liberado: true }> {
    const order = await this.getOrder(orderNumber, this.db);
    if (["CANCELADO", "EXPIRADO"].includes(order.status)) return { liberado: true };
    if (["CONFIRMADO", "USADO"].includes(order.status)) {
      throw new ConflictException({ code: "PAYMENT_ALREADY_COMPLETED" });
    }

    const payment = await this.first<any>(
      this.db.select().from(eventoPagamentos).where(eq(eventoPagamentos.orderId, order.id)),
    );
    if (payment?.stripeCheckoutSessionId) {
      if (!this.paymentsService) {
        throw new ServiceUnavailableException({ code: "CHECKOUT_UNAVAILABLE", message: "Checkout ainda indisponível" });
      }
      const estado = await this.paymentsService.encerrarCheckoutSessionSeAberta(payment.stripeCheckoutSessionId);
      if (estado === "concluida") {
        throw new ConflictException({ code: "PAYMENT_ALREADY_COMPLETED" });
      }
    }

    await this.db.transaction(async (tx: any) => {
      const current = await this.getOrder(orderNumber, tx);
      if (["CANCELADO", "EXPIRADO"].includes(current.status)) return;
      if (["CONFIRMADO", "USADO"].includes(current.status)) {
        throw new ConflictException({ code: "PAYMENT_ALREADY_COMPLETED" });
      }
      const now = new Date();
      await tx.update(eventoInventarioAssentos)
        .set({ status: "DISPONIVEL", reservationExpiresAt: null, reservedByOrderId: null, updatedAt: now })
        .where(and(eq(eventoInventarioAssentos.status, "RESERVADO"), eq(eventoInventarioAssentos.reservedByOrderId, current.id)));
      await tx.update(eventoReservas)
        .set({ status: "LIBERADA", releasedAt: now, updatedAt: now })
        .where(and(eq(eventoReservas.orderId, current.id), eq(eventoReservas.status, "ATIVA")));
      await tx.update(eventoPagamentos)
        .set({ status: "EXPIRADO", processedAt: now, updatedAt: now })
        .where(and(eq(eventoPagamentos.orderId, current.id), eq(eventoPagamentos.status, "PENDENTE")));
      await tx.update(eventoPedidos)
        .set({ status: "CANCELADO", cancelledAt: now, cancellationReason: "Lugares liberados pelo comprador", updatedAt: now })
        .where(eq(eventoPedidos.id, current.id));
    });
    return { liberado: true };
  }

  async liberarReservasExpiradas(now = new Date()) {
    return this.db.transaction(async (tx: any) => {
      const expired = await tx.select().from(eventoReservas).where(and(eq(eventoReservas.status, "ATIVA"), lte(eventoReservas.expiresAt, now)));
      let released = 0;
      for (const reservation of expired) {
        const order = await this.first<any>(tx.select().from(eventoPedidos).where(eq(eventoPedidos.id, reservation.orderId)));
        if (!order || ["CONFIRMADO", "USADO", "REEMBOLSADO"].includes(order.status)) continue;
        const inventoryUpdate = await tx.update(eventoInventarioAssentos).set({ status: "DISPONIVEL", reservationExpiresAt: null, reservedByOrderId: null, updatedAt: now }).where(and(eq(eventoInventarioAssentos.id, reservation.inventorySeatId), eq(eventoInventarioAssentos.status, "RESERVADO"), eq(eventoInventarioAssentos.reservedByOrderId, reservation.orderId), lte(eventoInventarioAssentos.reservationExpiresAt, now))).returning();
        if (!Array.isArray(inventoryUpdate) || inventoryUpdate.length !== 1) continue;
        const reservationUpdate = await tx.update(eventoReservas).set({ status: "LIBERADA", releasedAt: now, updatedAt: now }).where(and(eq(eventoReservas.id, reservation.id), eq(eventoReservas.status, "ATIVA"))).returning();
        if (!Array.isArray(reservationUpdate) || reservationUpdate.length !== 1) throw new ConflictException({ code: "RESERVATION_STATE_CHANGED", message: "Estado da reserva mudou durante a expiração" });
        if (["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"].includes(order.status)) await tx.update(eventoPedidos).set({ status: "EXPIRADO", cancelledAt: now, cancellationReason: "Reserva de Evento expirada", updatedAt: now }).where(and(eq(eventoPedidos.id, reservation.orderId), inArray(eventoPedidos.status, ["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"] as any)));
        released += 1;
      }
      return released;
    });
  }
}
