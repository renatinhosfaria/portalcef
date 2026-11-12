import { randomInt } from "node:crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  eventoAuditorias,
  eventoIngressos,
  eventoInventarioAssentos,
  eventoItensPedido,
  eventoLocais,
  eventoMapaAssentos,
  eventoMapas,
  eventoOperacoesAdministrativas,
  eventoParticipantes,
  eventoPedidos,
  eventoSessoes,
  eventoTiposIngresso,
  eventos,
  inArray,
  isNull,
  sql,
  users,
  type Database,
} from "@essencia/db";
import { gerarNumeroIngresso } from "@essencia/shared/eventos/ingresso";
import type { CancelarCortesiaInput, EmitirCortesiasInput } from "@essencia/shared/schemas";
import type { ConflitoAssentoCortesia, CortesiaResumo, EventoActor, MapaAdminSessao, PedidoComIngressos } from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";
import { assertSchoolScope } from "./eventos.service";
import { montarAssentosDaSessao, montarLayoutPublico } from "./montar-mapa-sessao";
import { montarIngressosDoPedido } from "./montar-pedido-ingressos";
import { gerarTokenIngresso } from "./token-ingresso";

const ALFABETO_PEDIDO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_TENTATIVAS = 5;
const UNICO_IDEMPOTENCIA = "uq_evento_pedidos_idempotency_key";
const UNICOS_SORTEADOS = ["uq_evento_pedidos_order_number", "uq_evento_ingressos_numero"];

/**
 * Devolve o nome da restrição quando o erro é violação de único (23505).
 * O Drizzle embrulha o erro do driver em `cause`, e o postgres-js chama o
 * campo de `constraint_name`; aceitamos as duas formas.
 */
function violacaoDeUnico(error: unknown): string | null {
  for (const candidato of [error, (error as { cause?: unknown } | null)?.cause] as any[]) {
    if (candidato?.code === "23505") return candidato.constraint_name ?? candidato.constraint ?? "";
  }
  return null;
}

function motivoDoConflito(inventario: any, sessionId: string): ConflitoAssentoCortesia["motivo"] | null {
  if (!inventario) return "INEXISTENTE";
  if (inventario.sessionId !== sessionId) return "OUTRA_SESSAO";
  if (inventario.status === "VENDIDO" || inventario.status === "BLOQUEADO") return inventario.status;
  if (inventario.status === "RESERVADO" || inventario.reservedByOrderId) return "RESERVADO";
  return null;
}

function assentosIndisponiveis(conflitos: ConflitoAssentoCortesia[]) {
  return new ConflictException({ code: "ASSENTOS_INDISPONIVEIS", message: "Um ou mais assentos não estão mais livres.", details: { conflitos } });
}

function cortesiaNaoEncontrada() {
  return new NotFoundException({ code: "CORTESIA_NOT_FOUND", message: "Cortesia não encontrada" });
}

@Injectable()
export class EventosCortesiasService {
  constructor(private readonly database: DatabaseService) {}

  private get db(): Database {
    return this.database.db;
  }

  private async first<T>(query: any): Promise<T | undefined> {
    const rows = await query;
    return rows?.[0];
  }

  private gerarOrderNumber(): string {
    return Array.from({ length: 12 }, () => ALFABETO_PEDIDO[randomInt(ALFABETO_PEDIDO.length)]).join("");
  }

  private porChave(chave: string) {
    return sql`starts_with(${eventoPedidos.idempotencyKey}, ${`cortesia:${chave}:`})`;
  }

  async emitir(eventId: string, input: EmitirCortesiasInput, actor: EventoActor): Promise<CortesiaResumo[]> {
    for (let tentativa = 1; ; tentativa += 1) {
      try {
        return await this.db.transaction((tx: any) => this.emitirNaTransacao(tx, eventId, input, actor));
      } catch (error) {
        const restricao = violacaoDeUnico(error);
        if (restricao === UNICO_IDEMPOTENCIA) {
          // Outra requisição com a mesma chave gravou primeiro: devolve o resultado dela.
          const vencedora = await this.consultarResumos(this.db, and(eq(eventoOperacoesAdministrativas.eventId, eventId), this.porChave(input.chave)));
          if (vencedora.length) return vencedora;
        } else if (restricao && UNICOS_SORTEADOS.includes(restricao) && tentativa < MAX_TENTATIVAS) {
          continue;
        }
        throw error;
      }
    }
  }

  async listar(eventId: string, actor: EventoActor): Promise<CortesiaResumo[]> {
    await this.carregarEvento(eventId, actor);
    return this.consultarResumos(this.db, eq(eventoOperacoesAdministrativas.eventId, eventId));
  }

  async cancelar(eventId: string, orderId: string, input: CancelarCortesiaInput, actor: EventoActor): Promise<CortesiaResumo> {
    await this.carregarEvento(eventId, actor);
    return this.db.transaction(async (tx: any) => {
      // Pedido → inventário → ingresso: a mesma ordem pedido → inventário da
      // confirmação de pagamento. Evento e sessão não são travados aqui.
      const pedido = await this.first<any>(tx.select().from(eventoPedidos).where(eq(eventoPedidos.id, orderId)).for("update"));
      if (!pedido || pedido.eventId !== eventId || pedido.origin !== "CORTESIA") throw cortesiaNaoEncontrada();
      const porPedido = eq(eventoPedidos.id, orderId);
      if (pedido.status === "CANCELADO") return (await this.consultarResumos(tx, porPedido))[0]!;

      const operacao = await this.first<any>(tx.select().from(eventoOperacoesAdministrativas).where(and(eq(eventoOperacoesAdministrativas.orderId, orderId), eq(eventoOperacoesAdministrativas.type, "CORTESIA"))));
      if (!operacao) throw cortesiaNaoEncontrada();
      await tx.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.id, operacao.inventorySeatId)).for("update");
      const ingresso = await this.first<any>(tx.select().from(eventoIngressos).where(eq(eventoIngressos.orderId, orderId)).for("update"));
      if (ingresso?.status === "USADO") throw new ConflictException({ code: "CORTESIA_JA_UTILIZADA", message: "Este ingresso já foi utilizado e não pode ser cancelado" });

      const agora = new Date();
      await tx.update(eventoIngressos).set({ status: "CANCELADO", revokedAt: agora, updatedAt: agora }).where(eq(eventoIngressos.orderId, orderId));
      await tx.update(eventoPedidos).set({ status: "CANCELADO", cancelledAt: agora, cancellationReason: input.motivo, updatedAt: agora }).where(eq(eventoPedidos.id, orderId));
      await tx.update(eventoOperacoesAdministrativas).set({ status: "CANCELADA", cancelledAt: agora, updatedAt: agora }).where(eq(eventoOperacoesAdministrativas.id, operacao.id));
      // Só devolve o assento se ele ainda estiver vendido por esta cortesia.
      await tx.update(eventoInventarioAssentos)
        .set({ status: "DISPONIVEL", soldAt: null, updatedAt: agora })
        .where(and(eq(eventoInventarioAssentos.id, operacao.inventorySeatId), eq(eventoInventarioAssentos.status, "VENDIDO")));
      await tx.insert(eventoAuditorias).values({
        eventId,
        sessionId: pedido.sessionId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "CORTESIA_CANCELADA",
        resourceType: "cortesia",
        resourceId: orderId,
        reason: input.motivo,
        metadata: { orderNumber: pedido.orderNumber },
      }).returning();

      return (await this.consultarResumos(tx, porPedido))[0]!;
    });
  }

  /** Dados do voucher sem exigir evento publicado, ao contrário da consulta pública do pedido. */
  async obterVoucher(eventId: string, orderId: string, actor: EventoActor): Promise<PedidoComIngressos> {
    const event = await this.carregarEvento(eventId, actor);
    const pedido = await this.first<any>(this.db.select().from(eventoPedidos).where(and(eq(eventoPedidos.id, orderId), eq(eventoPedidos.eventId, eventId), eq(eventoPedidos.origin, "CORTESIA"))));
    if (!pedido || pedido.status === "CANCELADO") throw cortesiaNaoEncontrada();
    const sessao = await this.first<any>(this.db.select().from(eventoSessoes).where(eq(eventoSessoes.id, pedido.sessionId)));
    const local = sessao?.locationId ? await this.first<any>(this.db.select().from(eventoLocais).where(eq(eventoLocais.id, sessao.locationId))) : undefined;
    const itens: any[] = await this.db
      .select({ item: eventoItensPedido, inventario: eventoInventarioAssentos, assento: eventoMapaAssentos, tipo: eventoTiposIngresso })
      .from(eventoItensPedido)
      .innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.id, eventoItensPedido.inventorySeatId))
      .innerJoin(eventoMapaAssentos, eq(eventoMapaAssentos.id, eventoInventarioAssentos.seatId))
      .innerJoin(eventoTiposIngresso, eq(eventoTiposIngresso.id, eventoItensPedido.ticketTypeId))
      .where(eq(eventoItensPedido.orderId, orderId));

    return {
      orderNumber: pedido.orderNumber,
      status: pedido.status,
      eventTitle: event.title ?? "",
      eventSlug: event.slug ?? "",
      sessionId: pedido.sessionId,
      expiresAt: pedido.expiresAt ?? null,
      session: { startsAt: sessao?.startsAt, endsAt: sessao?.endsAt },
      subtotalCents: pedido.subtotalCents ?? pedido.totalCents,
      discountCents: pedido.discountCents ?? 0,
      totalCents: pedido.totalCents,
      appliedOffer: null,
      items: itens.map(({ item, inventario, assento, tipo }) => ({
        seatId: inventario.seatId,
        ticketTypeId: item.ticketTypeId,
        unitPriceCents: item.unitPriceCents,
        totalPriceCents: item.totalPriceCents,
        rowLabel: assento.rowLabel,
        seatNumber: assento.seatNumber,
        ticketTypeName: tipo.name,
      })),
      buyerName: pedido.buyerName ?? null,
      event: { title: event.title ?? "", slug: event.slug ?? "", imageUrl: event.imageUrl ?? null, locationName: local?.name ?? null },
      tickets: await montarIngressosDoPedido(this.db, orderId),
    };
  }

  /** Mapa da sessão para o painel: exige só mapa confirmado, não evento publicado. */
  async obterMapaAdmin(eventId: string, sessionId: string, actor: EventoActor): Promise<MapaAdminSessao> {
    await this.carregarEvento(eventId, actor);
    const sessao = await this.first<any>(this.db.select().from(eventoSessoes).where(and(eq(eventoSessoes.id, sessionId), eq(eventoSessoes.eventId, eventId))));
    if (!sessao) throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "Sessão não encontrada" });
    const mapa = sessao.mapId ? await this.first<any>(this.db.select().from(eventoMapas).where(eq(eventoMapas.id, sessao.mapId))) : undefined;
    if (mapa?.status !== "CONFIRMADO") throw new ConflictException({ code: "MAP_NOT_CONFIRMED", message: "Confirme o mapa desta sessão para emitir cortesias" });

    const assentos = await montarAssentosDaSessao(this.db, sessionId, mapa.id);
    const seats = assentos.map(({ inventorySeatId: _inventorySeatId, inventoryStatus: _inventoryStatus, ...assento }) => assento);
    return {
      sessionId,
      mapId: mapa.id,
      seats,
      layout: montarLayoutPublico(mapa.layout, new Set(seats.map((seat) => seat.rowLabel))),
      inventarioPorAssento: Object.fromEntries(assentos.map((assento) => [assento.id, assento.inventorySeatId])),
    };
  }

  private async carregarEvento(eventId: string, actor: EventoActor): Promise<any> {
    const event = await this.first<any>(this.db.select().from(eventos).where(eq(eventos.id, eventId)));
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    assertSchoolScope(actor, event.schoolId);
    return event;
  }

  private async emitirNaTransacao(tx: any, eventId: string, input: EmitirCortesiasInput, actor: EventoActor): Promise<CortesiaResumo[]> {
    // Evento e sessão são travados antes do inventário, como na reserva pública
    // e na troca de mapa. O modo é NO KEY UPDATE: ele conflita com o FOR UPDATE
    // da reserva pública e consigo mesmo (serializa com a venda da sessão, com
    // outras emissões e com a criação do tipo "Cortesia", e faz uma requisição
    // repetida esperar a primeira antes de procurar a chave de idempotência).
    // Ele NÃO conflita com o FOR KEY SHARE que os INSERTs com FK pedem no
    // evento e na sessão. Com FOR UPDATE, a confirmação de pagamento, que
    // trava o inventário e só depois insere participante e ingresso, formaria
    // um ciclo de travas (deadlock) com esta emissão.
    const event = await this.first<any>(tx.select().from(eventos).where(eq(eventos.id, eventId)).for("no key update"));
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    assertSchoolScope(actor, event.schoolId);
    if (event.status === "CANCELADO") throw new ConflictException({ code: "EVENTO_CANCELADO", message: "Não é possível emitir cortesias em evento cancelado" });

    const session = await this.first<any>(tx.select().from(eventoSessoes).where(and(eq(eventoSessoes.id, input.sessionId), eq(eventoSessoes.eventId, eventId))).for("no key update"));
    if (!session || session.status === "CANCELADA") throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "Sessão não encontrada" });
    const mapa = session.mapId ? await this.first<any>(tx.select().from(eventoMapas).where(eq(eventoMapas.id, session.mapId))) : undefined;
    if (mapa?.status !== "CONFIRMADO") throw new ConflictException({ code: "MAP_NOT_CONFIRMED", message: "Confirme o mapa desta sessão para emitir cortesias" });

    const anteriores = await this.consultarResumos(tx, and(eq(eventoOperacoesAdministrativas.eventId, eventId), this.porChave(input.chave)));
    if (anteriores.length) return anteriores;

    // Trava em ordem crescente de id, a mesma da confirmação de pagamento.
    const idsOrdenados = [...new Set(input.assentos.map((assento) => assento.inventorySeatId))].sort();
    const inventarios = new Map<string, any>();
    for (const id of idsOrdenados) {
      const linha = await this.first<any>(tx.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.id, id)).for("update"));
      if (linha) inventarios.set(id, linha);
    }
    const seatIds = [...inventarios.values()].map((inventario) => inventario.seatId);
    const assentosDoMapa: any[] = seatIds.length ? await tx.select().from(eventoMapaAssentos).where(inArray(eventoMapaAssentos.id, seatIds)) : [];
    const conflito = (inventorySeatId: string, motivo: ConflitoAssentoCortesia["motivo"]): ConflitoAssentoCortesia => {
      const assento = assentosDoMapa.find((linha) => linha.id === inventarios.get(inventorySeatId)?.seatId);
      return { inventorySeatId, rowLabel: assento?.rowLabel ?? "", seatNumber: assento?.seatNumber ?? "", motivo };
    };

    const conflitos = input.assentos.flatMap(({ inventorySeatId }) => {
      const motivo = motivoDoConflito(inventarios.get(inventorySeatId), input.sessionId);
      return motivo ? [conflito(inventorySeatId, motivo)] : [];
    });
    if (conflitos.length) throw assentosIndisponiveis(conflitos);

    const tipo = await this.tipoCortesia(tx, eventId);
    const agora = new Date();

    // Venda condicional ao estado livre: se alguma linha não mudar, o lote inteiro é desfeito.
    const naoVendidos: ConflitoAssentoCortesia[] = [];
    for (const id of idsOrdenados) {
      const vendido = await tx.update(eventoInventarioAssentos)
        .set({ status: "VENDIDO", soldAt: agora, reservationExpiresAt: null, reservedByOrderId: null, updatedAt: agora })
        .where(and(eq(eventoInventarioAssentos.id, id), inArray(eventoInventarioAssentos.status, ["DISPONIVEL", "LIBERADO"]), isNull(eventoInventarioAssentos.reservedByOrderId)))
        .returning();
      if (vendido.length !== 1) naoVendidos.push(conflito(id, "RESERVADO"));
    }
    if (naoVendidos.length) throw assentosIndisponiveis(naoVendidos);

    const orderIds: string[] = [];
    const orderNumbers: string[] = [];
    for (const assento of input.assentos) {
      const [pedido] = await tx.insert(eventoPedidos).values({
        eventId,
        sessionId: input.sessionId,
        orderNumber: this.gerarOrderNumber(),
        buyerName: input.grupo,
        buyerEmail: input.contatoEmail ?? null,
        buyerPhone: input.contatoTelefone ?? null,
        status: "CONFIRMADO",
        origin: "CORTESIA",
        totalCents: 0,
        subtotalCents: 0,
        discountCents: 0,
        idempotencyKey: `cortesia:${input.chave}:${assento.inventorySeatId}`,
        expiresAt: null,
        confirmedAt: agora,
      }).returning();
      const [participante] = await tx.insert(eventoParticipantes).values({
        eventId,
        orderId: pedido.id,
        type: "CONVIDADO",
        fullName: assento.nome ?? input.grupo,
      }).returning();
      const [item] = await tx.insert(eventoItensPedido).values({
        orderId: pedido.id,
        inventorySeatId: assento.inventorySeatId,
        ticketTypeId: tipo.id,
        participantId: participante.id,
        quantity: 1,
        unitPriceCents: 0,
        totalPriceCents: 0,
        pricingEvidence: { origem: "CORTESIA" },
      }).returning();
      await tx.insert(eventoIngressos).values({
        numero: gerarNumeroIngresso(),
        orderId: pedido.id,
        itemId: item.id,
        sessionId: input.sessionId,
        inventorySeatId: assento.inventorySeatId,
        participantId: participante.id,
        status: "EMITIDO",
        ...gerarTokenIngresso(pedido.orderNumber, item.id),
      }).returning();
      await tx.insert(eventoOperacoesAdministrativas).values({
        eventId,
        sessionId: input.sessionId,
        inventorySeatId: assento.inventorySeatId,
        type: "CORTESIA",
        status: "ATIVA",
        participantId: participante.id,
        orderId: pedido.id,
        reason: input.motivo,
        createdBy: actor.userId,
        createdAt: agora,
      }).returning();
      orderIds.push(pedido.id);
      orderNumbers.push(pedido.orderNumber);
    }

    await tx.insert(eventoAuditorias).values({
      eventId,
      sessionId: input.sessionId,
      actorId: actor.userId,
      actorRole: actor.role,
      action: "CORTESIA_EMITIDA",
      resourceType: "cortesia",
      reason: input.motivo,
      metadata: { grupo: input.grupo, quantidade: orderIds.length, orderNumbers },
    }).returning();

    return this.consultarResumos(tx, inArray(eventoPedidos.id, orderIds));
  }

  /** Tipo interno "Cortesia" do evento; criado na primeira emissão. A trava do evento evita duplicá-lo. */
  private async tipoCortesia(tx: any, eventId: string): Promise<{ id: string }> {
    const existente = await this.first<{ id: string }>(tx.select().from(eventoTiposIngresso).where(and(eq(eventoTiposIngresso.eventId, eventId), eq(eventoTiposIngresso.internal, true), eq(eventoTiposIngresso.name, "Cortesia"))));
    if (existente) return existente;
    const [criado] = await tx.insert(eventoTiposIngresso).values({ eventId, name: "Cortesia", priceCents: 0, internal: true, active: true }).returning();
    return criado;
  }

  private async consultarResumos(db: any, filtro: unknown): Promise<CortesiaResumo[]> {
    const linhas: any[] = await db
      .select({ operacao: eventoOperacoesAdministrativas, pedido: eventoPedidos, participante: eventoParticipantes, ingresso: eventoIngressos, assento: eventoMapaAssentos, sessao: eventoSessoes, usuario: users })
      .from(eventoOperacoesAdministrativas)
      .innerJoin(eventoPedidos, eq(eventoPedidos.id, eventoOperacoesAdministrativas.orderId))
      .innerJoin(eventoParticipantes, eq(eventoParticipantes.id, eventoOperacoesAdministrativas.participantId))
      .innerJoin(eventoIngressos, eq(eventoIngressos.orderId, eventoOperacoesAdministrativas.orderId))
      .innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.id, eventoOperacoesAdministrativas.inventorySeatId))
      .innerJoin(eventoMapaAssentos, eq(eventoMapaAssentos.id, eventoInventarioAssentos.seatId))
      .innerJoin(eventoSessoes, eq(eventoSessoes.id, eventoOperacoesAdministrativas.sessionId))
      .leftJoin(users, eq(users.id, eventoOperacoesAdministrativas.createdBy))
      .where(and(eq(eventoOperacoesAdministrativas.type, "CORTESIA"), filtro as any))
      .orderBy(desc(eventoOperacoesAdministrativas.createdAt), asc(eventoMapaAssentos.rowLabel), asc(eventoMapaAssentos.seatNumber));
    return linhas.map(({ operacao, pedido, participante, ingresso, assento, sessao, usuario }) => ({
      orderId: pedido.id,
      orderNumber: pedido.orderNumber,
      session: { id: sessao.id, startsAt: sessao.startsAt },
      rowLabel: assento.rowLabel,
      seatNumber: assento.seatNumber,
      participantName: participante.fullName,
      grupo: pedido.buyerName ?? "",
      motivo: operacao.reason,
      numero: ingresso.numero,
      situacao: pedido.status === "CANCELADO" ? "CANCELADA" : ingresso.status === "USADO" ? "USADA" : "ATIVA",
      emitidaPor: usuario?.name ?? "",
      emitidaEm: operacao.createdAt,
      canceladaEm: operacao.cancelledAt ?? pedido.cancelledAt ?? null,
    }));
  }
}
