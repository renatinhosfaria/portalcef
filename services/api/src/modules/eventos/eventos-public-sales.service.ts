import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException, forwardRef } from "@nestjs/common";
import { and, asc, desc, eq, eventoAceites, eventoIngressos, eventoInventarioAssentos, eventoItensPedido, eventoLocais, eventoMapaAssentos, eventoOfertas, eventoPagamentos, eventoParticipantes, eventoPedidos, eventoPoliticas, eventoReservas, eventoSessoes, eventoTiposIngresso, eventoTokensConsulta, eventos, gt, inArray, isNull, lte, or, schema, type Database } from "@essencia/db";
import { finalizarPedidoSchema, meusIngressosSchema, pagamentoEmbutidoSchema, reservaPublicaSchema, type FinalizarPedidoInput, type MeusIngressosInput, type PagamentoEmbutidoInput, type ReservaPublicaInput } from "@essencia/shared/schemas";
import { calcularPrecoPedido, type OfertaPreco } from "@essencia/shared/eventos/precos";
import type { ConsultaPedidoPublica, FinalizacaoPublicaResult, MeusIngressosResult, PagamentoEmbutidoResult, PedidoComIngressos, PedidoPublicoResult, PoliticaPublica, ReservaPublicaResult } from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";
import { PaymentsService } from "../payments/payments.service";
import { gerarTokenAcesso, hashTokenAcesso, validadeAcesso } from "./acesso-pedido";
import { violacaoDeUnico } from "../../common/database/violacao-unico";

const fail = (code: string, message: string) => new BadRequestException({ code, message });
const validated = <T>(schema: { safeParse(value: unknown): { success: boolean; data?: T } }, value: unknown): T => { const result = schema.safeParse(value); if (!result.success) throw fail("VALIDATION_ERROR", "Dados inválidos"); return result.data as T; };
const eventoLocaisTabela = (eventoLocais as any) ?? (schema as any)?.eventoLocais ?? { id: "evento_locais.id" };
const eventoTokensConsultaTabela = (eventoTokensConsulta as any) ?? (schema as any)?.eventoTokensConsulta ?? { __eventoTokensConsulta: true, tokenHash: "evento_tokens_consulta.token_hash", orderId: "evento_tokens_consulta.order_id", expiresAt: "evento_tokens_consulta.expires_at" };

@Injectable()
export class EventosPublicSalesService {
  private readonly checkoutLocks = new Map<string, Promise<void>>();

  constructor(private readonly database: DatabaseService, @Inject(forwardRef(() => PaymentsService)) private readonly paymentsService: PaymentsService = undefined as never) {}
  private get db(): Database { return this.database.db; }
  private async first<T>(query: any): Promise<T | undefined> { const rows = await query; return rows?.[0]; }
  private async lockRows<T>(query: any, tables?: any[]): Promise<T> {
    return typeof query?.for === "function"
      ? tables?.length ? query.for("update", { of: tables }) : query.for("update")
      : query;
  }
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
        if (!(await this.reservaIdempotenteCompativel(tx, existing, input))) {
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
      const inventoryBySeat = new Map<string, any>();
      const orderedRequests = [...input.seats].sort((left, right) => left.seatId.localeCompare(right.seatId));
      const snapshotsBySeat = new Map<string, any>();
      for (const requested of orderedRequests) {
        const snapshotQuery = tx.select().from(eventoInventarioAssentos).where(and(eq(eventoInventarioAssentos.sessionId, input.sessionId), eq(eventoInventarioAssentos.seatId, requested.seatId)));
        snapshotsBySeat.set(requested.seatId, await this.first<any>(snapshotQuery));
      }
      const staleOrderIds = [...new Set(orderedRequests
        .map((requested) => snapshotsBySeat.get(requested.seatId))
        .filter((inventory) => inventory?.status === "RESERVADO" && inventory.reservedByOrderId && inventory.reservationExpiresAt instanceof Date && inventory.reservationExpiresAt <= now)
        .map((inventory) => inventory.reservedByOrderId))].sort();
      for (const staleOrderId of staleOrderIds) {
        await this.first<any>(this.lockRows(tx.select().from(eventoPedidos).where(eq(eventoPedidos.id, staleOrderId))));
      }
      // A ordem de aquisição dos locks precisa ser independente da ordem da
      // aba. Assim, [A,B] e [B,A] não formam um ciclo no PostgreSQL.
      for (const requested of orderedRequests) {
        const inventoryQuery = tx.select().from(eventoInventarioAssentos).where(and(eq(eventoInventarioAssentos.sessionId, input.sessionId), eq(eventoInventarioAssentos.seatId, requested.seatId)));
        const inventory = await this.first<any>(await this.lockRows(inventoryQuery));
        if (!inventory || !["DISPONIVEL", "LIBERADO", "RESERVADO"].includes(inventory.status)) {
          throw new ConflictException({ code: "SEAT_UNAVAILABLE", message: "Assento indisponível" });
        }
        if (inventory.status === "RESERVADO" && (!inventory.reservationExpiresAt || inventory.reservationExpiresAt > now)) {
          throw new ConflictException({ code: "SEAT_UNAVAILABLE", message: "Assento indisponível" });
        }
        inventoryBySeat.set(requested.seatId, inventory);
      }
      for (const requested of input.seats) selected.push({ inventory: inventoryBySeat.get(requested.seatId), ticket: ticketById.get(requested.ticketTypeId), requested });

      const rawOffers = await this.lockRows<any[]>(tx.select().from(eventoOfertas).where(and(eq(eventoOfertas.eventId, event.id), eq(eventoOfertas.active, true))));
      const activeOffers = rawOffers.filter((candidate: any) => candidate.active);
      if (activeOffers.length > 1) {
        throw new ConflictException({ code: "MULTIPLE_ACTIVE_OFFERS", message: "Mais de uma oferta ativa para o evento" });
      }
      const quantidade = selected.length;
      const ofertaFixaAplicavel = activeOffers.find((candidate: any) => {
        if (candidate.pricingType !== "VALOR_FIXO") return false;
        const inRange = quantidade >= candidate.minQuantity && (candidate.maxQuantity === null || candidate.maxQuantity === undefined || quantidade <= candidate.maxQuantity);
        if (!inRange) return false;
        const compatible = candidate.compatibleTicketTypeIds as string[] | null | undefined;
        return !compatible || selected.every((item) => compatible.includes(item.ticket.id));
      });
      if (ofertaFixaAplicavel) {
        throw fail("OFFER_NOT_SUPPORTED_PUBLIC", "A oferta de valor fixo não está disponível na compra pública");
      }
      // O contrato público expõe apenas descontos percentuais; ofertas de valor
      // fixo permanecem administrativas e não podem alterar um total que a UI
      // não consegue calcular.
      const offers: OfertaPreco[] = activeOffers
        .filter((candidate: any) => candidate.pricingType === "PERCENTUAL")
        .filter((candidate: any) => {
          const inRange = quantidade >= candidate.minQuantity && (candidate.maxQuantity === null || candidate.maxQuantity === undefined || quantidade <= candidate.maxQuantity);
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
      // O takeover invalida o pedido antigo inteiro, mas só libera inventários
      // que ainda pertencem a ele. Assim, os demais assentos do pedido não
      // ficam órfãos e um assento já retomado por outro pedido não é tocado.
      for (const staleOrderId of staleOrderIds) {
        const oldReservationsQuery = tx.select().from(eventoReservas).where(and(eq(eventoReservas.orderId, staleOrderId), eq(eventoReservas.status, "ATIVA")));
        const oldReservations = [...(await oldReservationsQuery)].sort((left: any, right: any) => String(left.inventorySeatId).localeCompare(String(right.inventorySeatId)) || String(left.id).localeCompare(String(right.id)));
        for (const oldReservation of oldReservations) {
          const oldInventory = await this.first<any>(this.lockRows(tx.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.id, oldReservation.inventorySeatId))));
          const ownsInventory = oldInventory?.status === "RESERVADO" && oldInventory.reservedByOrderId === staleOrderId;
          if (ownsInventory) {
            await tx.update(eventoInventarioAssentos).set({ status: "DISPONIVEL", reservationExpiresAt: null, reservedByOrderId: null, updatedAt: now }).where(and(eq(eventoInventarioAssentos.id, oldInventory.id), eq(eventoInventarioAssentos.status, "RESERVADO"), eq(eventoInventarioAssentos.reservedByOrderId, staleOrderId))).returning();
          }
          // A reserva antiga também precisa sair de ATIVA mesmo se o inventário
          // já tiver sido vendido/bloqueado por outra operação; a proteção acima
          // garante que nunca alteramos esse inventário alheio.
          await tx.update(eventoReservas).set({ status: "LIBERADA", releasedAt: now, updatedAt: now }).where(and(eq(eventoReservas.id, oldReservation.id), eq(eventoReservas.status, "ATIVA"))).returning();
        }
        await tx.update(eventoPedidos).set({ status: "EXPIRADO", cancelledAt: now, cancellationReason: "Reserva de Evento expirada", updatedAt: now }).where(and(eq(eventoPedidos.id, staleOrderId), inArray(eventoPedidos.status, ["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"] as any))).returning();
        await tx.update(eventoPagamentos).set({ status: "EXPIRADO", processedAt: now, updatedAt: now }).where(and(eq(eventoPagamentos.orderId, staleOrderId), eq(eventoPagamentos.status, "PENDENTE"))).returning();
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
      if (violacaoDeUnico(error) !== null) {
        const existing = await this.first<any>(this.db.select().from(eventoPedidos).where(eq(eventoPedidos.idempotencyKey, input.idempotencyKey)));
        if (existing) {
          if (!(await this.reservaIdempotenteCompativel(this.db, existing, input))) {
            throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Chave de idempotência já utilizada" });
          }
          return this.reservaResult(this.db, existing);
        }
      }
      throw error;
    }) : executar(this.db);
  }

  private async reservaIdempotenteCompativel(db: any, order: any, input: ReservaPublicaInput): Promise<boolean> {
    if (order.sessionId && order.sessionId !== input.sessionId) return false;
    const rows = await db.select({ item: eventoItensPedido, inventory: eventoInventarioAssentos }).from(eventoItensPedido).innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.id, eventoItensPedido.inventorySeatId)).where(eq(eventoItensPedido.orderId, order.id));
    if (!rows.length) return false;
    const assinatura = (seat: { seatId: string; ticketTypeId: string; participantIndex: number }) => `${seat.seatId}|${seat.ticketTypeId}|${seat.participantIndex}`;
    const persisted = rows.map((row: any) => {
      const participantIndex = row.item?.pricingEvidence?.participantIndex;
      return participantIndex === undefined ? null : assinatura({ seatId: row.inventory?.seatId, ticketTypeId: row.item?.ticketTypeId, participantIndex });
    }).filter(Boolean).sort();
    const requested = input.seats.map((seat) => assinatura(seat)).sort();
    return persisted.length === requested.length && persisted.every((value: string, index: number) => value === requested[index]);
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
    return this.serializarCheckout(orderNumber, () => this.db.transaction(async (tx: any) => {
      const order = await this.getOrder(orderNumber, tx, true);
      const prior = await this.first<any>(tx.select().from(eventoPedidos).where(eq(eventoPedidos.finalizationIdempotencyKey, input.idempotencyKey)));
      if (prior) { if (prior.id !== order.id) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Chave de idempotência já utilizada" }); return this.finalizacaoResult(order, tx); }
      if (order.finalizationIdempotencyKey) {
        if (order.finalizationIdempotencyKey === input.idempotencyKey) return this.finalizacaoResult(order, tx);
        throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Pedido já finalizado com outra chave" });
      }
      if (!["INICIADO", "RESERVADO"].includes(order.status) || (order.expiresAt && order.expiresAt <= new Date())) throw fail("ORDER_NOT_AVAILABLE", "Pedido expirado ou indisponível");
      const buyer = { name: input.buyer.name.trim(), email: input.buyer.email.trim().toLowerCase(), phone: this.normalizePhone(input.buyer.phone) };
      const policies = await tx.select().from(eventoPoliticas).where(and(eq(eventoPoliticas.eventId, order.eventId), eq(eventoPoliticas.active, true)));
      for (const acceptance of input.acceptances) { const policy = policies.find((p: any) => p.type === acceptance.type && p.version === acceptance.version); if (!policy) throw fail("POLICY_VERSION_MISMATCH", "Versão de política inválida"); await tx.insert(eventoAceites).values({ orderId: order.id, type: acceptance.type, policyId: policy.id, policyVersion: policy.version, acceptedByName: buyer.name, acceptedByEmail: buyer.email }); }
      const items = await tx.select().from(eventoItensPedido).where(eq(eventoItensPedido.orderId, order.id));
      const itensOrdenados = [...items].sort((left: any, right: any) => String(left.inventorySeatId).localeCompare(String(right.inventorySeatId)) || String(left.id).localeCompare(String(right.id)));
      if (itensOrdenados.length !== input.participants.length) throw fail("VALIDATION_ERROR", "Participantes devem corresponder aos itens");
      for (const item of itensOrdenados) {
        const inventoryQuery = tx.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.id, item.inventorySeatId));
        const inventory = await this.first<any>(this.lockRows(inventoryQuery));
        const reservationQuery = tx.select().from(eventoReservas).where(and(eq(eventoReservas.orderId, order.id), eq(eventoReservas.inventorySeatId, item.inventorySeatId), eq(eventoReservas.status, "ATIVA")));
        const reservation = await this.first<any>(this.lockRows(reservationQuery));
        if (!reservation || !inventory || inventory.status !== "RESERVADO" || inventory.reservedByOrderId !== order.id || (reservation.expiresAt && reservation.expiresAt <= new Date())) {
          throw fail("ORDER_NOT_AVAILABLE", "A reserva expirou ou não está mais disponível");
        }
      }
      for (const participant of input.participants) { const [created] = await tx.insert(eventoParticipantes).values({ eventId: order.eventId, orderId: order.id, type: participant.type, fullName: participant.fullName, email: participant.email ?? null, phone: participant.phone ?? null }).returning(); const item = itensOrdenados.find((candidate: any) => candidate.pricingEvidence?.participantIndex === participant.participantIndex); if (!item) throw fail("VALIDATION_ERROR", "Participante sem item correspondente"); if (created) await tx.update(eventoItensPedido).set({ participantId: created.id, updatedAt: new Date() }).where(eq(eventoItensPedido.id, item.id)); }
      await tx.update(eventoPedidos).set({ buyerName: buyer.name, buyerEmail: buyer.email, buyerPhone: buyer.phone, status: "RESERVADO", finalizationIdempotencyKey: input.idempotencyKey, updatedAt: new Date() }).where(eq(eventoPedidos.id, order.id));
      const finalizado = { ...order, ...buyer, buyerName: buyer.name, buyerEmail: buyer.email, buyerPhone: buyer.phone, status: "RESERVADO", finalizationIdempotencyKey: input.idempotencyKey };
      return this.finalizacaoResult(finalizado, tx);
    }).catch(async (error: any) => { if (violacaoDeUnico(error) !== null) { const existing = await this.first<any>(this.db.select().from(eventoPedidos).where(eq(eventoPedidos.finalizationIdempotencyKey, input.idempotencyKey))); const ownOrder = await this.getOrder(orderNumber, this.db); if (existing?.id === ownOrder.id) return this.finalizacaoResult(ownOrder, this.db); throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Chave de idempotência já utilizada" }); } throw error; }));
  }

  private async finalizacaoResult(order: any, db: any): Promise<FinalizacaoPublicaResult> {
    const pedido = await this.pedidoResult(order, db);
    const { token, hash } = gerarTokenAcesso();
    const expiresAt = validadeAcesso(order.session?.endsAt ?? order.session?.startsAt);
    await db.insert(eventoTokensConsulta).values({ orderId: order.id, email: order.buyerEmail, tokenHash: hash, expiresAt });
    return { pedido, acesso: token };
  }

  private async serializarCheckout<T>(orderNumber: string, callback: () => Promise<T>): Promise<T> {
    const anterior = this.checkoutLocks.get(orderNumber) ?? Promise.resolve();
    let liberar!: () => void;
    const atual = new Promise<void>((resolve) => { liberar = resolve; });
    const fila = anterior.then(() => atual);
    this.checkoutLocks.set(orderNumber, fila);
    await anterior;
    try {
      return await callback();
    } finally {
      liberar();
      if (this.checkoutLocks.get(orderNumber) === fila) this.checkoutLocks.delete(orderNumber);
    }
  }

  private async validarReservasCheckout(db: any, order: any, items: any[]): Promise<void> {
    const reservations = await db.select().from(eventoReservas).where(and(eq(eventoReservas.orderId, order.id), eq(eventoReservas.status, "ATIVA")));
    const inventories = await db.select().from(eventoInventarioAssentos).where(and(eq(eventoInventarioAssentos.reservedByOrderId, order.id), eq(eventoInventarioAssentos.status, "RESERVADO")));
    const inventoryIds = new Set(inventories.map((inventory: any) => inventory.id));
    const itemInventoryIds = items.map((row: any) => row.item?.inventorySeatId).filter((id: unknown): id is string => typeof id === "string");
    const expectedInventoryIds = new Set(itemInventoryIds);
    const ownershipDiverged = itemInventoryIds.length > 0 && (expectedInventoryIds.size !== items.length || expectedInventoryIds.size !== inventories.length || [...expectedInventoryIds].some((id) => !inventoryIds.has(id)));
    if (!reservations.length || inventories.length !== reservations.length || ownershipDiverged || reservations.some((reservation: any) => (reservation.expiresAt && reservation.expiresAt <= new Date()) || !inventoryIds.has(reservation.inventorySeatId))) {
      throw fail("ORDER_NOT_AVAILABLE", "A reserva expirou ou não está mais disponível");
    }
  }

  async iniciarCheckout(orderNumber: string, raw: unknown): Promise<PagamentoEmbutidoResult> {
    const input = validated<PagamentoEmbutidoInput>(pagamentoEmbutidoSchema, raw);
    if (!this.paymentsService) throw new ServiceUnavailableException({ code: "CHECKOUT_UNAVAILABLE", message: "Checkout ainda indisponível" });
    this.validarUrlCheckout(input.returnUrl);
    return this.serializarCheckout(orderNumber, async () => {
      const executar = async (db: any): Promise<PagamentoEmbutidoResult> => {
        const order = await this.getOrder(orderNumber, db, true);
        if (!["RESERVADO", "AGUARDANDO_PAGAMENTO"].includes(order.status)) throw fail("ORDER_NOT_AVAILABLE", "Pedido indisponível para checkout");
        if (!order.buyerEmail?.trim()) throw fail("ORDER_NOT_FINALIZED", "Pedido ainda não foi finalizado");
        if (order.expiresAt && order.expiresAt <= new Date()) throw fail("ORDER_NOT_AVAILABLE", "Pedido expirado ou indisponível");
        const minimumCheckoutExpiry = new Date(Date.now() + 30 * 60_000);
        const checkoutExpiresAt = order.expiresAt && order.expiresAt > minimumCheckoutExpiry ? order.expiresAt : minimumCheckoutExpiry;
        const rows = await db.select({ item: eventoItensPedido, ticket: eventoTiposIngresso }).from(eventoItensPedido).innerJoin(eventoTiposIngresso, eq(eventoTiposIngresso.id, eventoItensPedido.ticketTypeId)).where(eq(eventoItensPedido.orderId, order.id));
        if (!rows.length) throw fail("ORDER_NOT_AVAILABLE", "Pedido sem itens");
        await this.validarReservasCheckout(db, order, rows);
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

        const existing = await this.first<any>(db.select().from(eventoPagamentos).where(eq(eventoPagamentos.orderId, order.id)));
        if (existing?.status === "PENDENTE" && existing.stripeCheckoutSessionId) {
          const clientSecret = await this.paymentsService.obterClientSecretSeAberta(existing.stripeCheckoutSessionId);
          if (clientSecret) {
            await this.estenderCheckout(order.id, checkoutExpiresAt, db);
            return { clientSecret, expiresAt: checkoutExpiresAt, orderNumber: order.orderNumber };
          }
        }

        const checkout = await this.paymentsService.createEmbeddedCheckoutSession({
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalCents,
          customerName: order.buyerName,
          customerPhone: order.buyerPhone,
          customerEmail: order.buyerEmail,
          expiresAt: checkoutExpiresAt,
          items,
          returnUrl: input.returnUrl,
          idempotencyKey: `evento-checkout:${order.id}:${input.idempotencyKey}`,
          eventOrderId: order.id,
        });
        if (existing) {
          await db.update(eventoPagamentos).set({ stripeCheckoutSessionId: checkout.checkoutSessionId, stripePaymentIntentId: checkout.paymentIntentId ?? null, expectedAmountCents: linesTotalCents, status: "PENDENTE", updatedAt: new Date() }).where(eq(eventoPagamentos.id, existing.id));
        } else {
          await db.insert(eventoPagamentos).values({ orderId: order.id, stripeCheckoutSessionId: checkout.checkoutSessionId, stripePaymentIntentId: checkout.paymentIntentId ?? null, method: "card", expectedAmountCents: linesTotalCents, receivedAmountCents: null, currency: "BRL", status: "PENDENTE" });
        }
        await this.estenderCheckout(order.id, checkoutExpiresAt, db);
        return { clientSecret: checkout.clientSecret, expiresAt: checkoutExpiresAt, orderNumber: order.orderNumber };
      };
      return typeof (this.db as any).transaction === "function" ? this.db.transaction(executar) : executar(this.db);
    });
  }
  private async estenderCheckout(orderId: string, checkoutExpiresAt: Date, db: any = this.db) {
    await db.update(eventoPedidos).set({ status: "AGUARDANDO_PAGAMENTO", expiresAt: checkoutExpiresAt, updatedAt: new Date() }).where(and(eq(eventoPedidos.id, orderId), inArray(eventoPedidos.status, ["RESERVADO", "INICIADO", "AGUARDANDO_PAGAMENTO"] as any)));
    await db.update(eventoReservas).set({ expiresAt: checkoutExpiresAt, updatedAt: new Date() }).where(and(eq(eventoReservas.orderId, orderId), eq(eventoReservas.status, "ATIVA")));
    await db.update(eventoInventarioAssentos).set({ reservationExpiresAt: checkoutExpiresAt, updatedAt: new Date() }).where(and(eq(eventoInventarioAssentos.reservedByOrderId, orderId), eq(eventoInventarioAssentos.status, "RESERVADO")));
  }
  private validarUrlCheckout(value: string) {
    const configured = (process.env.EVENTOS_PUBLIC_URL || "https://eventos.portalcef.com.br").replace(/\/$/, "");
    let url: URL;
    let origin: URL;
    try { url = new URL(value); origin = new URL(configured); } catch { throw fail("CHECKOUT_URL_NOT_ALLOWED", "URL de checkout não permitida"); }
    if (url.protocol !== "https:" || url.origin !== origin.origin) throw fail("CHECKOUT_URL_NOT_ALLOWED", "URL de checkout não permitida");
  }

  async obterIngressos(orderNumber: string, acesso: string): Promise<PedidoComIngressos> {
    const order = await this.getOrder(orderNumber, this.db);
    if (typeof acesso !== "string" || acesso.length === 0) {
      throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" });
    }
    const tokenHash = hashTokenAcesso(acesso);
    const tokenRows = await this.db.select().from(eventoTokensConsultaTabela).where(and(
      eq(eventoTokensConsultaTabela.tokenHash, tokenHash),
      eq(eventoTokensConsultaTabela.orderId, order.id),
      or(isNull(eventoTokensConsultaTabela.expiresAt), gt(eventoTokensConsultaTabela.expiresAt, new Date())),
    ));
    const token = await this.first<any>(tokenRows);
    if (!token || token.orderId !== order.id || (token.expiresAt && token.expiresAt <= new Date())) throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" });

    const pedido = await this.pedidoResult(order, this.db);
    const tickets = ["CONFIRMADO", "USADO"].includes(order.status)
      ? (await this.db.select({ ticket: eventoIngressos, item: eventoItensPedido, inventory: eventoInventarioAssentos, seat: eventoMapaAssentos, ticketType: eventoTiposIngresso, participant: eventoParticipantes }).from(eventoIngressos).innerJoin(eventoItensPedido, eq(eventoItensPedido.id, eventoIngressos.itemId)).innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.id, eventoIngressos.inventorySeatId)).innerJoin(eventoMapaAssentos, eq(eventoMapaAssentos.id, eventoInventarioAssentos.seatId)).innerJoin(eventoTiposIngresso, eq(eventoTiposIngresso.id, eventoItensPedido.ticketTypeId)).innerJoin(eventoParticipantes, eq(eventoParticipantes.id, eventoIngressos.participantId)).where(eq(eventoIngressos.orderId, order.id))).map((row: any) => ({
        numero: row.ticket?.numero,
        qrPayload: row.ticket?.qrPayload,
        rowLabel: row.seat?.rowLabel ?? row.inventory?.rowLabel ?? "",
        seatNumber: row.seat?.seatNumber ?? row.inventory?.seatNumber ?? "",
        ticketTypeName: row.ticketType?.name ?? row.item?.ticketTypeName ?? "",
        participantName: row.participant?.fullName ?? "",
        status: row.ticket?.status,
      }))
      : [];

    return {
      ...pedido,
      buyerName: order.buyerName ?? null,
      event: {
        title: order.event?.title ?? "",
        slug: order.event?.slug ?? "",
        imageUrl: order.event?.imageUrl ?? null,
        locationName: order.location?.name ?? order.event?.locationName ?? order.session?.locationName ?? null,
      },
      tickets,
    };
  }

  async buscarMeusIngressos(raw: unknown): Promise<MeusIngressosResult> {
    const input = validated<MeusIngressosInput>(meusIngressosSchema, raw);
    const email = input.email.trim().toLowerCase();
    const phone = "phone" in input ? this.normalizePhone(input.phone) : null;
    const orderNumber = "orderNumber" in input ? input.orderNumber.trim() : null;
    const rows = await this.db.select({ order: eventoPedidos, event: eventos, session: eventoSessoes }).from(eventoPedidos).innerJoin(eventos, eq(eventos.id, eventoPedidos.eventId)).innerJoin(eventoSessoes, eq(eventoSessoes.id, eventoPedidos.sessionId)).where(orderNumber ? eq(eventoPedidos.orderNumber, orderNumber) : undefined);
    const encontrados = rows.filter((row: any) => {
      const order = row.order ?? row;
      const sameEmail = String(order.buyerEmail ?? "").trim().toLowerCase() === email;
      const sameOrder = !orderNumber || order.orderNumber === orderNumber;
      const samePhone = !phone || this.normalizePhone(String(order.buyerPhone ?? "")) === phone;
      return sameEmail && sameOrder && samePhone && ["CONFIRMADO", "USADO"].includes(order.status) && row.event?.status === "PUBLICADO" && row.session?.status === "PUBLICADA";
    });
    if (!encontrados.length) throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Não encontramos um pedido com esses dados" });

    const pedidos: MeusIngressosResult["pedidos"] = [];
    for (const row of encontrados) {
      const order = row.order ?? row;
      const session = row.session ?? {};
      const { token, hash } = gerarTokenAcesso();
      await this.db.insert(eventoTokensConsultaTabela).values({ orderId: order.id, email: order.buyerEmail, tokenHash: hash, expiresAt: validadeAcesso(session.endsAt) });
      pedidos.push({ orderNumber: order.orderNumber, eventTitle: row.event?.title ?? "", sessionStartsAt: session.startsAt, acesso: token });
    }
    return { pedidos };
  }

  async consultarPedido(orderNumber: string, db: any = this.db): Promise<ConsultaPedidoPublica> { const order = await this.getOrder(orderNumber, db); if (order.expiresAt && order.expiresAt <= new Date() && !["CONFIRMADO", "USADO"].includes(order.status)) throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" }); return this.pedidoResult(order, db); }
  private async pedidoResult(order: any, db: any): Promise<PedidoPublicoResult> { if (order.event?.status !== "PUBLICADO" || order.session?.status !== "PUBLICADA") throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" }); const itemsQuery = db.select({ item: eventoItensPedido, inventory: eventoInventarioAssentos, seat: eventoMapaAssentos, ticket: eventoTiposIngresso }).from(eventoItensPedido).innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.id, eventoItensPedido.inventorySeatId)).innerJoin(eventoMapaAssentos, eq(eventoMapaAssentos.id, eventoInventarioAssentos.seatId)).innerJoin(eventoTiposIngresso, eq(eventoTiposIngresso.id, eventoItensPedido.ticketTypeId)).where(eq(eventoItensPedido.orderId, order.id)); const rows = typeof itemsQuery.orderBy === "function" ? await itemsQuery.orderBy(asc(eventoItensPedido.createdAt)) : await itemsQuery; const orderedRows = [...rows].sort((left: any, right: any) => (left.item?.pricingEvidence?.participantIndex ?? Number.MAX_SAFE_INTEGER) - (right.item?.pricingEvidence?.participantIndex ?? Number.MAX_SAFE_INTEGER)); const snapshot = order.appliedOffer ?? orderedRows.find((row: any) => row.item?.pricingEvidence?.offerSnapshot)?.item?.pricingEvidence?.offerSnapshot ?? null; return { orderNumber: order.orderNumber, status: order.status, eventTitle: order.event?.title ?? "", eventSlug: order.event?.slug ?? "", sessionId: order.session?.id ?? order.sessionId, expiresAt: order.expiresAt ?? null, session: { startsAt: order.session?.startsAt, endsAt: order.session?.endsAt }, subtotalCents: order.subtotalCents ?? order.totalCents, discountCents: order.discountCents ?? 0, totalCents: order.totalCents, appliedOffer: snapshot, items: orderedRows.map((row: any) => ({ seatId: row.inventory?.seatId, ticketTypeId: row.item?.ticketTypeId, participantIndex: row.item?.pricingEvidence?.participantIndex, unitPriceCents: row.item?.unitPriceCents, totalPriceCents: row.item?.totalPriceCents, rowLabel: row.seat?.rowLabel ?? row.inventory?.rowLabel ?? "", seatNumber: row.seat?.seatNumber ?? row.inventory?.seatNumber ?? "", ticketTypeName: row.ticket?.name ?? row.item?.ticketTypeName ?? "" })) }; }
  private async getOrder(orderNumber: string, db: any, lock = false): Promise<any> { let query = db.select({ order: eventoPedidos, event: eventos, session: eventoSessoes, location: eventoLocaisTabela }).from(eventoPedidos).innerJoin(eventos, eq(eventos.id, eventoPedidos.eventId)).innerJoin(eventoSessoes, eq(eventoSessoes.id, eventoPedidos.sessionId)); if (typeof query.leftJoin === "function") query = query.leftJoin(eventoLocaisTabela, eq(eventoLocaisTabela.id, eventoSessoes.locationId)); query = query.where(eq(eventoPedidos.orderNumber, orderNumber)); const result = await this.first<any>(lock ? await this.lockRows(query, [eventoPedidos, eventos, eventoSessoes]) : query); if (!result) throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" }); return result.order ? { ...result.order, event: result.event, session: result.session, location: result.location } : result; }
  private updatedExactlyOne(result: any): boolean { if (typeof result?.count === "number") return result.count === 1; return Array.isArray(result) ? result.length === 1 : result?.rowCount === 1; }

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
      const current = await this.getOrder(orderNumber, tx, true);
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
      const updatedOrder = await tx.update(eventoPedidos)
        .set({ status: "CANCELADO", cancelledAt: now, cancellationReason: "Lugares liberados pelo comprador", updatedAt: now })
        .where(and(
          eq(eventoPedidos.id, current.id),
          inArray(eventoPedidos.status, ["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"] as any),
        ));
      if (!this.updatedExactlyOne(updatedOrder)) {
        const latest = await this.getOrder(orderNumber, tx, true);
        if (["CONFIRMADO", "USADO"].includes(latest.status)) {
          throw new ConflictException({ code: "PAYMENT_ALREADY_COMPLETED" });
        }
        if (["CANCELADO", "EXPIRADO"].includes(latest.status)) return;
        throw new ConflictException({ code: "ORDER_STATE_CHANGED", message: "Estado do pedido mudou durante a liberação" });
      }
    });
    return { liberado: true };
  }

  async liberarReservasExpiradas(now = new Date()) {
    return this.db.transaction(async (tx: any) => {
      const expired = await tx.select().from(eventoReservas).where(and(eq(eventoReservas.status, "ATIVA"), lte(eventoReservas.expiresAt, now)));
      const reservasExpiradasOrdenadas = [...expired].sort((left: any, right: any) => String(left.orderId).localeCompare(String(right.orderId)) || String(left.inventorySeatId).localeCompare(String(right.inventorySeatId)) || String(left.id).localeCompare(String(right.id)));
      let released = 0;
      for (const reservation of reservasExpiradasOrdenadas) {
        // O job usa a mesma ordem de confirmação/falha: pedido, inventário,
        // reserva e, por fim, pagamento. Assim não segura inventário esperando
        // por uma transação que já bloqueou o pedido.
        const order = await this.first<any>(this.lockRows(tx.select().from(eventoPedidos).where(eq(eventoPedidos.id, reservation.orderId))));
        if (!order || ["CONFIRMADO", "USADO", "REEMBOLSADO"].includes(order.status)) continue;
        const inventory = await this.first<any>(this.lockRows(tx.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.id, reservation.inventorySeatId))));
        if (!inventory) continue;
        const currentReservation = await this.first<any>(this.lockRows(tx.select().from(eventoReservas).where(eq(eventoReservas.id, reservation.id))));
        if (!currentReservation || currentReservation.status !== "ATIVA" || (currentReservation.expiresAt && currentReservation.expiresAt > now)) continue;
        const inventoryIsOwnedAndExpired = inventory.status === "RESERVADO"
          && inventory.reservedByOrderId === currentReservation.orderId
          && inventory.reservationExpiresAt instanceof Date
          && inventory.reservationExpiresAt <= now;
        if (inventoryIsOwnedAndExpired) {
          const inventoryUpdate = await tx.update(eventoInventarioAssentos).set({ status: "DISPONIVEL", reservationExpiresAt: null, reservedByOrderId: null, updatedAt: now }).where(and(eq(eventoInventarioAssentos.id, currentReservation.inventorySeatId), eq(eventoInventarioAssentos.status, "RESERVADO"), eq(eventoInventarioAssentos.reservedByOrderId, currentReservation.orderId), lte(eventoInventarioAssentos.reservationExpiresAt, now))).returning();
          if (!this.updatedExactlyOne(inventoryUpdate)) {
            const latestInventory = await this.first<any>(this.lockRows(tx.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.id, currentReservation.inventorySeatId))));
            if (!latestInventory || !["DISPONIVEL", "LIBERADO"].includes(latestInventory.status) || latestInventory.reservedByOrderId) continue;
          }
        } else if (!["DISPONIVEL", "LIBERADO"].includes(inventory.status) || inventory.reservedByOrderId) {
          // O lugar foi vendido, bloqueado ou retomado por outra reserva; não
          // toque nessa reserva sem confirmar que ela ainda é a proprietária.
          continue;
        }
        const reservationUpdate = await tx.update(eventoReservas).set({ status: "LIBERADA", releasedAt: now, updatedAt: now }).where(and(eq(eventoReservas.id, currentReservation.id), eq(eventoReservas.status, "ATIVA"))).returning();
        if (!this.updatedExactlyOne(reservationUpdate)) continue;
        if (["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"].includes(order.status)) {
          await tx.update(eventoPedidos).set({ status: "EXPIRADO", cancelledAt: now, cancellationReason: "Reserva de Evento expirada", updatedAt: now }).where(and(eq(eventoPedidos.id, reservation.orderId), inArray(eventoPedidos.status, ["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"] as any)));
          await tx.update(eventoPagamentos).set({ status: "EXPIRADO", processedAt: now, updatedAt: now }).where(and(eq(eventoPagamentos.orderId, reservation.orderId), eq(eventoPagamentos.status, "PENDENTE")));
        }
        released += 1;
      }
      return released;
    });
  }
}
