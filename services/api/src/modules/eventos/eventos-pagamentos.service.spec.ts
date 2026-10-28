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

  it("serializa duas confirmações concorrentes: uma emite e a outra recebe PAYMENT_IN_PROGRESS", async () => {
    const db = new FakeEventosDb();
    const service = new EventosPagamentosService({ db } as any);
    const results = await Promise.allSettled([
      service.confirmarCheckout({ checkoutSessionId: "cs-1", amountCents: 1_000 }),
      service.confirmarCheckout({ checkoutSessionId: "cs-1", amountCents: 1_000 }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { response: { code: "PAYMENT_IN_PROGRESS" } } });
    expect(db.state.tickets).toHaveLength(1);
  });

  it("rejeita PROCESSANDO ativo e recupera PROCESSANDO stale", async () => {
    const db = new FakeEventosDb();
    db.state.payment.status = "PROCESSANDO";
    db.state.payment.updatedAt = new Date();
    const service = new EventosPagamentosService({ db } as any);
    await expect(service.confirmarCheckout({ checkoutSessionId: "cs-1", amountCents: 1_000 })).rejects.toMatchObject({ response: { code: "PAYMENT_IN_PROGRESS" } });
    expect(db.state.tickets).toHaveLength(0);
  });

  it("resolve PaymentIntent sem referência persistida usando eventOrderId", async () => {
    const db = new FakeEventosDb();
    db.state.payment.stripePaymentIntentId = null;
    const service = new EventosPagamentosService({ db } as any);
    await service.confirmarCheckout({ checkoutSessionId: "", paymentIntentId: "pi-novo", eventOrderId: db.state.order.id, amountCents: 1_000 });
    expect(db.state.payment.stripePaymentIntentId).toBe("pi-novo");
    expect(db.state.tickets).toHaveLength(1);
  });

  it("rejeita checkout e PaymentIntent que apontam para referências conflitantes", async () => {
    const db = new FakeEventosDb();
    const service = new EventosPagamentosService({ db } as any);
    await expect(service.confirmarCheckout({ checkoutSessionId: "cs-1", paymentIntentId: "pi-outro", eventOrderId: db.state.order.id, amountCents: 1_000 })).rejects.toMatchObject({ response: { code: "PAYMENT_REFERENCE_CONFLICT" } });
    expect(db.state.order.status).toBe("AGUARDANDO_PAGAMENTO");
  });

  it("recupera pagamento PROCESSANDO stale sem permitir dois processamentos ativos", async () => {
    const db = new FakeEventosDb();
    db.state.payment.status = "PROCESSANDO";
    db.state.payment.updatedAt = new Date(Date.now() - 10 * 60_000);
    const service = new EventosPagamentosService({ db } as any);
    await service.confirmarCheckout({ checkoutSessionId: "cs-1", amountCents: 1_000 });
    expect(db.state.payment.status).toBe("APROVADO");
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

  it("falha PaymentIntent sem ID persistido usando eventOrderId e libera a reserva", async () => {
    const db = new FakeEventosDb();
    db.state.payment.stripePaymentIntentId = null;
    const service = new EventosPagamentosService({ db } as any);
    await service.falharCheckout({ checkoutSessionId: "", paymentIntentId: "pi-falha", eventOrderId: db.state.order.id, reason: "Checkout expirado" });
    expect(db.state.inventory.status).toBe("DISPONIVEL");
    expect(db.state.reservation.status).toBe("LIBERADA");
    expect(db.state.payment.status).toBe("EXPIRADO");
    expect(db.state.order.status).toBe("CANCELADO");
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
    db.state.inventory.reservationExpiresAt = new Date("2026-10-28T11:00:00Z");
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
    const chain: any = { table: undefined, predicate: undefined, from: (table: any) => { chain.table = table; return chain; }, innerJoin: () => chain, where: async (predicate: any) => { chain.predicate = predicate; if (selection?.payment) return this.matches(predicate, this.state.payment) || this.matches(predicate, this.state.order) ? [{ payment: this.state.payment, order: this.state.order }] : []; if (chain.table === eventoPedidos) return this.matches(predicate, this.state.order) ? [this.state.order] : []; if (chain.table === eventoItensPedido) return this.matches(predicate, this.state.item) ? [this.state.item] : []; if (chain.table === eventoReservas) return this.state.reservation.status === "ATIVA" && this.matches(predicate, this.state.reservation) ? [this.state.reservation] : []; if (chain.table === eventoInventarioAssentos) return this.matches(predicate, this.state.inventory) ? [this.state.inventory] : []; if (chain.table === eventoIngressos) return this.state.tickets.filter((ticket: any) => this.matches(predicate, ticket)); return []; } };
    return chain;
  }
  update(table: any) {
    const operation: any = { values: undefined, predicate: undefined, set: (values: any) => { operation.values = values; return operation; }, where: (predicate: any) => { operation.predicate = predicate; return operation; }, returning: async () => { const entity = table === eventoPagamentos ? this.state.payment : table === eventoInventarioAssentos ? this.state.inventory : table === eventoReservas ? this.state.reservation : this.state.order; if (operation.predicate && !this.matches(operation.predicate, entity)) return []; Object.assign(entity, operation.values); return [entity]; } };
    return operation;
  }
  matches(predicate: any, entity: any): boolean { if (!predicate || !predicate.name) return true; if (predicate.name === "and") return predicate.args.every((item: any) => this.matches(item, entity)); if (predicate.name === "or") return predicate.args.some((item: any) => this.matches(item, entity)); if (predicate.name === "eq" || predicate.name === "lte") { const marker = predicate.args[0]; const value = marker?.__column ? entity[marker.__column] : undefined; return predicate.name === "eq" ? value === predicate.args[1] : value instanceof Date && value <= predicate.args[1]; } if (predicate.name === "inArray") { const marker = predicate.args[0]; return predicate.args[1]?.includes(marker?.__column ? entity[marker.__column] : undefined); } return true; }
  insert(table: any) { const operation: any = { values: (values: any) => { operation.payload = values; return operation; }, returning: async () => { if (table === eventoIngressos) { this.state.tickets.push(operation.payload); return [operation.payload]; } return [{ id: "created-participant" }]; } }; return operation; }
}
