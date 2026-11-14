import { eventoAuditorias, eventoIngressos, eventoInventarioAssentos, eventoItensPedido, eventoPedidos, eventoReservas } from "@essencia/db";
import { EventosConfirmacaoService } from "./eventos-confirmacao.service";

describe("EventosConfirmacaoService", () => {
  beforeAll(() => { process.env.EVENTOS_QR_SECRET = "teste-segredo-qr"; });

  it("confirma pedido gratuito, emite ingresso e converte o uso do cupom uma vez", async () => {
    const db = confirmationDb({ order: { totalCents: 0, appliedCouponId: "coupon-1", couponDiscountCents: 1000 } });
    const cupons = { confirmarUso: jest.fn().mockResolvedValue(undefined) };
    const service = new EventosConfirmacaoService(cupons as any);

    await service.confirmarPedido("order-1", "CORTESIA_100", db as any);
    await service.confirmarPedido("order-1", "CORTESIA_100", db as any);

    expect(db.state.order.status).toBe("CONFIRMADO");
    expect(db.state.inventory.status).toBe("VENDIDO");
    expect(db.state.reservation.status).toBe("CONVERTIDA");
    expect(db.state.tickets).toHaveLength(1);
    expect(cupons.confirmarUso).toHaveBeenCalledTimes(1);
    expect(db.state.audits).toEqual([expect.objectContaining({ action: "CONFIRMADO", metadata: expect.objectContaining({ origem: "CORTESIA_100" }) })]);
  });

  it("não cria nem exige registro de pagamento Stripe no caminho gratuito", async () => {
    const db = confirmationDb({ order: { totalCents: 0 }, payment: undefined });

    await expect(new EventosConfirmacaoService(undefined as any).confirmarPedido("order-1", "CORTESIA_100", db as any)).resolves.toBeUndefined();

    expect(db.state.payments).toHaveLength(0);
    expect(db.state.tickets).toHaveLength(1);
  });
});

function confirmationDb(options: { order?: Record<string, unknown>; payment?: Record<string, unknown> } = {}) {
  const state: any = {
    order: { id: "order-1", eventId: "event-1", sessionId: "session-1", orderNumber: "EVT123456789", status: "RESERVADO", totalCents: 1000, buyerName: "Ana", buyerEmail: "ana@example.com", buyerPhone: "11999999999", ...options.order },
    items: [{ id: "item-1", orderId: "order-1", inventorySeatId: "inventory-1", participantId: "participant-1", ticketTypeId: "ticket-1" }],
    reservation: { id: "reservation-1", orderId: "order-1", inventorySeatId: "inventory-1", status: "ATIVA", expiresAt: new Date(Date.now() + 60_000) },
    inventory: { id: "inventory-1", status: "RESERVADO", reservedByOrderId: "order-1", reservationExpiresAt: new Date(Date.now() + 60_000) },
    tickets: [] as any[],
    audits: [] as any[],
    payments: options.payment ? [{ id: "payment-1", orderId: "order-1", status: "PENDENTE" }] : [],
  };

  const tableName = (table: any) => table === eventoPedidos ? "eventoPedidos" : table === eventoItensPedido ? "eventoItensPedido" : table === eventoReservas ? "eventoReservas" : table === eventoInventarioAssentos ? "eventoInventarioAssentos" : table === eventoIngressos ? "eventoIngressos" : table === eventoAuditorias ? "eventoAuditorias" : undefined;
  const matches = (predicate: any, entity: any, table: any): boolean => {
    if (!predicate?.name) return true;
    if (predicate.name === "and") return predicate.args.every((item: any) => matches(item, entity, table));
    if (predicate.name === "eq") {
      const marker = predicate.args[0];
      return marker?.__table === tableName(table) && entity?.[marker.__column] === predicate.args[1];
    }
    return true;
  };
  const rows = (table: any) => table === eventoPedidos ? [state.order] : table === eventoItensPedido ? state.items : table === eventoReservas ? [state.reservation] : table === eventoInventarioAssentos ? [state.inventory] : table === eventoIngressos ? state.tickets : [];
  const db: any = { state, transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db) };
  db.select = () => {
    const chain: any = { table: undefined, predicate: undefined, from: (table: any) => { chain.table = table; return chain; }, where: (predicate: any) => { chain.predicate = predicate; const result: any[] = rows(chain.table).filter((entity: any) => matches(predicate, entity, chain.table)); const promise: any = Promise.resolve(result); promise.for = () => promise; return promise; } };
    return chain;
  };
  db.update = (table: any) => ({ set: (values: any) => ({ where: (predicate: any) => ({ returning: async () => { const changed = rows(table).filter((entity: any) => matches(predicate, entity, table)); changed.forEach((entity: any) => Object.assign(entity, values)); return changed; } }) }) });
  db.insert = (table: any) => ({ values: (values: any) => ({ returning: async () => { if (table === eventoIngressos) state.tickets.push(values); if (table === eventoAuditorias) state.audits.push(values); return [values]; } }) });
  return db;
}
