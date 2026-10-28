import { eventoIngressos, eventoInventarioAssentos, eventoItensPedido, eventoPagamentos, eventoPedidos, eventoReservas } from "@essencia/db";
import { EventosPagamentosService } from "./eventos-pagamentos.service";
import { EventosExpirationJob } from "./jobs/eventos-expiration.job";
import { EventosPublicSalesService } from "./eventos-public-sales.service";

beforeAll(() => { process.env.EVENTOS_QR_SECRET = "teste-segredo-qr"; });

describe("EventosPagamentosService", () => {
  it("rejeita valor divergente sem vender assentos", async () => {
    const db = new FakeEventosDb();
    const service = new EventosPagamentosService({ db } as any);
    await expect(service.confirmarCheckout({ checkoutSessionId: "cs-1", paymentIntentId: "pi-1", amountCents: 999 })).rejects.toMatchObject({ response: { code: "PAYMENT_AMOUNT_MISMATCH" } });
    expect(db.transactionCalls).toBe(0);
    expect(db.state.inventory.status).toBe("RESERVADO");
  });

  it("falha atomicamente quando uma reserva não está ativa", async () => {
    const db = new FakeEventosDb();
    db.state.reservation.status = "LIBERADA";
    const service = new EventosPagamentosService({ db } as any);
    await expect(service.confirmarCheckout({ checkoutSessionId: "cs-1", amountCents: 1_000 })).rejects.toMatchObject({ response: { code: "RESERVATION_NOT_ACTIVE" } });
    expect(db.state.payment.status).toBe("PENDENTE");
    expect(db.state.order.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(db.state.inventory.status).toBe("RESERVADO");
    expect(db.state.tickets).toHaveLength(0);
  });

  it("converte cada reserva em ingresso somente após vender o inventário", async () => {
    const db = new FakeEventosDb();
    const service = new EventosPagamentosService({ db } as any);
    await service.confirmarCheckout({ checkoutSessionId: "cs-1", amountCents: 1_000 });
    expect(db.state.inventory.status).toBe("VENDIDO");
    expect(db.state.reservation.status).toBe("CONVERTIDA");
    expect(db.state.payment.status).toBe("APROVADO");
    expect(db.state.order.status).toBe("CONFIRMADO");
    expect(db.state.tickets).toHaveLength(1);
    expect(db.state.tickets[0].signedToken).toContain(".");
  });

  it("é idempotente com duas confirmações concorrentes e emite um único ingresso", async () => {
    const db = new FakeEventosDb();
    const service = new EventosPagamentosService({ db } as any);
    await Promise.all([
      service.confirmarCheckout({ checkoutSessionId: "cs-1", amountCents: 1_000 }),
      service.confirmarCheckout({ checkoutSessionId: "cs-1", amountCents: 1_000 }),
    ]);
    expect(db.state.tickets).toHaveLength(1);
  });

  it("resolve PaymentIntent sem referência persistida usando eventOrderId", async () => {
    const db = new FakeEventosDb();
    db.state.payment.stripePaymentIntentId = null;
    const service = new EventosPagamentosService({ db } as any);
    await service.confirmarCheckout({ checkoutSessionId: "", paymentIntentId: "pi-novo", eventOrderId: db.state.order.id, amountCents: 1_000 });
    expect(db.state.payment.stripePaymentIntentId).toBe("pi-novo");
    expect(db.state.tickets).toHaveLength(1);
  });

  it("não libera um assento já vendido durante falha de checkout", async () => {
    const db = new FakeEventosDb();
    db.state.inventory.status = "VENDIDO";
    const service = new EventosPagamentosService({ db } as any);
    await expect(service.falharCheckout({ checkoutSessionId: "cs-1", reason: "Checkout expirado" })).rejects.toMatchObject({ response: { code: "SEAT_STATE_CHANGED" } });
    expect(db.state.reservation.status).toBe("ATIVA");
    expect(db.state.order.status).toBe("AGUARDANDO_PAGAMENTO");
  });

  it("exige segredo dedicado para assinar ingressos", () => {
    const original = process.env.EVENTOS_QR_SECRET;
    delete process.env.EVENTOS_QR_SECRET;
    expect(() => new EventosPagamentosService({ db: new FakeEventosDb() } as any)).toThrow("EVENTOS_QR_SECRET");
    process.env.EVENTOS_QR_SECRET = original;
  });
});

describe("EventosExpirationJob", () => {
  it("libera a reserva uma vez e a segunda execução não altera nada", async () => {
    const db = new FakeEventosDb();
    db.state.reservation.expiresAt = new Date("2026-10-28T11:00:00Z");
    const sales = new EventosPublicSalesService({ db } as any);
    const job = new EventosExpirationJob(sales);
    await expect(job.liberarExpirados(new Date("2026-10-28T12:00:00Z"))).resolves.toBe(1);
    await expect(job.liberarExpirados(new Date("2026-10-28T12:00:00Z"))).resolves.toBe(0);
    expect(db.state.inventory.status).toBe("DISPONIVEL");
    expect(db.state.reservation.status).toBe("LIBERADA");
  });
});

class FakeEventosDb {
  transactionCalls = 0;
  state: any = {
    payment: { id: "payment-1", orderId: "order-1", stripeCheckoutSessionId: "cs-1", stripePaymentIntentId: "pi-1", expectedAmountCents: 1_000, status: "PENDENTE", method: "card" },
    order: { id: "order-1", eventId: "event-1", sessionId: "session-1", orderNumber: "EVT123456789", status: "AGUARDANDO_PAGAMENTO", totalCents: 1_000, buyerName: "Ana", buyerEmail: "ana@example.com", buyerPhone: "11999999999" },
    item: { id: "item-1", orderId: "order-1", inventorySeatId: "inventory-1", participantId: "participant-1", ticketTypeId: "ticket-1" },
    reservation: { id: "reservation-1", orderId: "order-1", inventorySeatId: "inventory-1", status: "ATIVA", expiresAt: new Date("2026-10-28T13:00:00Z") },
    inventory: { id: "inventory-1", status: "RESERVADO", reservedByOrderId: "order-1", reservationExpiresAt: new Date("2026-10-28T13:00:00Z") },
    tickets: [] as any[],
  };
  transaction = async (callback: (tx: this) => Promise<unknown>) => { this.transactionCalls += 1; const snapshot = structuredClone(this.state); try { return await callback(this); } catch (error) { this.state = snapshot; throw error; } };
  select(selection?: any) {
    const chain: any = { table: undefined, from: (table: any) => { chain.table = table; return chain; }, innerJoin: () => chain, where: async () => { if (selection?.payment) return [{ payment: this.state.payment, order: this.state.order }]; if (chain.table === eventoPedidos) return [this.state.order]; if (chain.table === eventoItensPedido) return [this.state.item]; if (chain.table === eventoReservas) return this.state.reservation.status === "ATIVA" ? [this.state.reservation] : []; if (chain.table === eventoInventarioAssentos) return [this.state.inventory]; if (chain.table === eventoIngressos) return this.state.tickets; return []; } };
    return chain;
  }
  update(table: any) {
    const operation: any = { values: undefined, set: (values: any) => { operation.values = values; return operation; }, where: () => operation, returning: async () => { if (table === eventoPagamentos) { if (operation.values.status === "PROCESSANDO" && this.state.payment.status !== "PENDENTE") return []; Object.assign(this.state.payment, operation.values); return [this.state.payment]; } if (table === eventoInventarioAssentos) { if (["VENDIDO", "DISPONIVEL"].includes(operation.values.status) && this.state.inventory.status !== "RESERVADO") return []; Object.assign(this.state.inventory, operation.values); return [this.state.inventory]; } if (table === eventoReservas) { if (["CONVERTIDA", "LIBERADA"].includes(operation.values.status) && this.state.reservation.status !== "ATIVA") return []; Object.assign(this.state.reservation, operation.values); return [this.state.reservation]; } if (table === eventoPedidos) { Object.assign(this.state.order, operation.values); return [this.state.order]; } return [{}]; } };
    return operation;
  }
  insert(table: any) { const operation: any = { values: (values: any) => { operation.payload = values; return operation; }, returning: async () => { if (table === eventoIngressos) { this.state.tickets.push(operation.payload); return [operation.payload]; } return [{ id: "created-participant" }]; } }; return operation; }
}
