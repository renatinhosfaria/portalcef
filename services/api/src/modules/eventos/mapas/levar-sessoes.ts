import { BadRequestException } from "@nestjs/common";
import {
  and,
  asc,
  eq,
  eventoInventarioAssentos,
  eventoItensPedido,
  eventoMapaAssentos,
  eventoPedidos,
  eventoReservas,
  eventoSessoes,
  inArray,
  type Database,
} from "@essencia/db";

import { STATUS_PEDIDO_ABERTO, STATUS_PEDIDO_PAGO } from "./trava-venda";

export interface ResultadoLevarSessoes {
  sessionIds: string[];
  inventarioCriado: number;
  capacidade: number | null;
  pedidosDesligados: string[];
}

type LockRows = <T>(query: unknown) => Promise<T[]>;

const encerrados = new Set(["EXPIRADO", "CANCELADO"]);
const pagos = new Set<string>(STATUS_PEDIDO_PAGO);
const abertos = new Set<string>(STATUS_PEDIDO_ABERTO);

function tentativaEncerrada(pedido: { status: string; expiresAt: Date | null }, agora: Date): boolean {
  if (encerrados.has(pedido.status)) return true;
  return abertos.has(pedido.status) && (pedido.expiresAt === null || pedido.expiresAt.getTime() <= agora.getTime());
}

export async function levarSessoesParaVersao(
  db: Database,
  entrada: {
    eventId: string;
    versaoId: string;
    agora: Date;
    sessionIds?: string[];
    lockRows: LockRows;
  },
): Promise<ResultadoLevarSessoes> {
  const sessionCondition = entrada.sessionIds?.length
    ? and(eq(eventoSessoes.eventId, entrada.eventId), inArray(eventoSessoes.id, entrada.sessionIds))
    : eq(eventoSessoes.eventId, entrada.eventId);
  const sessionsQuery = db.select().from(eventoSessoes).where(sessionCondition);
  const sessionsOrdered = typeof (sessionsQuery as any).orderBy === "function" ? (sessionsQuery as any).orderBy(asc(eventoSessoes.id)) : sessionsQuery;
  const sessoes = await entrada.lockRows<any>(sessionsOrdered);
  const sessionIds = sessoes.map((sessao) => sessao.id).sort();

  const lugares = await db.select().from(eventoMapaAssentos).where(eq(eventoMapaAssentos.mapId, entrada.versaoId));
  if (!lugares.length) throw new BadRequestException({ code: "MAP_EMPTY", message: "O mapa precisa de pelo menos um assento" });

  const inventoryCondition = sessionIds.length
    ? inArray(eventoInventarioAssentos.sessionId, sessionIds)
    : eq(eventoInventarioAssentos.sessionId, "__nenhuma__");
  const inventoryQuery = db.select().from(eventoInventarioAssentos).where(inventoryCondition);
  const inventoryOrdered = typeof (inventoryQuery as any).orderBy === "function" ? (inventoryQuery as any).orderBy(asc(eventoInventarioAssentos.id)) : inventoryQuery;
  const inventarioAntigo = await entrada.lockRows<any>(inventoryOrdered);
  const inventoryIds = inventarioAntigo.map((item) => item.id);

  const orderQuery = sessionIds.length
    ? db.select().from(eventoPedidos).where(inArray(eventoPedidos.sessionId, sessionIds))
    : db.select().from(eventoPedidos).where(eq(eventoPedidos.sessionId, "__nenhuma__"));
  const ordersOrdered = typeof (orderQuery as any).orderBy === "function" ? (orderQuery as any).orderBy(asc(eventoPedidos.id)) : orderQuery;
  const pedidos = await entrada.lockRows<any>(ordersOrdered);
  const itemQuery = inventoryIds.length
    ? db.select().from(eventoItensPedido).where(inArray(eventoItensPedido.inventorySeatId, inventoryIds))
    : db.select().from(eventoItensPedido).where(eq(eventoItensPedido.inventorySeatId, "__nenhuma__"));
  const itens = await entrada.lockRows<any>(typeof (itemQuery as any).orderBy === "function" ? (itemQuery as any).orderBy(asc(eventoItensPedido.id)) : itemQuery);
  const reservationQuery = inventoryIds.length
    ? db.select().from(eventoReservas).where(inArray(eventoReservas.inventorySeatId, inventoryIds))
    : db.select().from(eventoReservas).where(eq(eventoReservas.inventorySeatId, "__nenhuma__"));
  const reservas = await entrada.lockRows<any>(typeof (reservationQuery as any).orderBy === "function" ? (reservationQuery as any).orderBy(asc(eventoReservas.id)) : reservationQuery);

  const pedidosPorId = new Map(pedidos.map((pedido) => [pedido.id, pedido]));
  if (itens.some((item) => pagos.has(pedidosPorId.get(item.orderId)?.status))) {
    throw new BadRequestException({ code: "VENDA_CONFIRMADA", message: "Bloqueado: já há lugares vendidos com pagamento confirmado neste evento." });
  }

  const pedidosDesligados = pedidos.filter((pedido) => tentativaEncerrada(pedido, entrada.agora));
  const pedidosAExpirar = pedidosDesligados.filter((pedido) => abertos.has(pedido.status) && pedido.status !== "EXPIRADO");
  for (const pedido of pedidosAExpirar) {
    await db.update(eventoPedidos).set({ status: "EXPIRADO", updatedAt: entrada.agora }).where(eq(eventoPedidos.id, pedido.id));
  }
  const pedidosEncerrados = new Set(pedidosDesligados.map((pedido) => pedido.id));
  const itemIds = itens.filter((item) => pedidosEncerrados.has(item.orderId)).map((item) => item.id);
  const reservaIds = reservas.filter((reserva) => pedidosEncerrados.has(reserva.orderId)).map((reserva) => reserva.id);
  if (itemIds.length) await db.delete(eventoItensPedido).where(inArray(eventoItensPedido.id, itemIds));
  if (reservaIds.length) await db.delete(eventoReservas).where(inArray(eventoReservas.id, reservaIds));
  if (sessionIds.length) await db.delete(eventoInventarioAssentos).where(inArray(eventoInventarioAssentos.sessionId, sessionIds));

  const capacidade = sessionIds.length ? lugares.filter((lugar: any) => lugar.sellable !== false).length : null;
  let inventarioCriado = 0;
  for (const sessao of sessoes) {
    for (const lugar of lugares) {
      await db.insert(eventoInventarioAssentos).values({
        sessionId: sessao.id,
        seatId: lugar.id,
        status: lugar.sellable === false ? "BLOQUEADO" : "DISPONIVEL",
        blockedReason: lugar.sellable === false ? "MAPA_ASSENTO_NAO_VENDAVEL" : null,
      });
      inventarioCriado += 1;
    }
    await db.update(eventoSessoes).set({ mapId: entrada.versaoId, capacity: capacidade, updatedAt: entrada.agora }).where(eq(eventoSessoes.id, sessao.id));
  }

  return { sessionIds, inventarioCriado, capacidade, pedidosDesligados: pedidosDesligados.map((pedido) => pedido.id) };
}
