import { and, eq, eventoIngressos, eventoInventarioAssentos, eventoItensPedido, eventoPagamentos, eventoPedidos, eventoReservas, inArray, lte, or } from "@essencia/db";
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

describe("FakeEventosDb", () => {
  it("rejeita predicado de tabela errada mesmo quando os valores coincidem", async () => {
    const db = new FakeEventosDb();
    const sameId = "valor-compartilhado";
    const sameDate = new Date("2026-10-28T12:00:00Z");
    db.state.payment.id = sameId;
    db.state.order.id = sameId;
    db.state.payment.updatedAt = sameDate;
    db.state.payment.orderId = sameId;

    expect(db.matches(eq(eventoPedidos.id, sameId), db.state.payment)).toBe(false);
    expect(db.matches(and(eq(eventoPedidos.id, sameId)), db.state.payment)).toBe(false);
    expect(db.matches(or(eq(eventoPedidos.id, sameId)), db.state.payment)).toBe(false);
    expect(db.matches(lte(eventoPedidos.updatedAt, sameDate), db.state.payment)).toBe(false);
    expect(db.matches(inArray(eventoPedidos.id, [sameId]), db.state.payment)).toBe(false);

    await expect(
      db
        .select({ payment: eventoPagamentos, order: eventoPedidos })
        .from(eventoPagamentos)
        .innerJoin(eventoPedidos, eq(eventoPedidos.id, eventoPagamentos.orderId))
        .where(eq(eventoPedidos.orderId, sameId)),
    ).resolves.toEqual([]);
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
    const chain: any = {
      table: undefined,
      predicate: undefined,
      from: (table: any) => { chain.table = table; return chain; },
      innerJoin: () => chain,
      where: async (predicate: any) => {
        chain.predicate = predicate;
        if (selection?.payment) {
          const joined = { eventoPagamentos: this.state.payment, eventoPedidos: this.state.order };
          return this.matches(predicate, joined) ? [{ payment: this.state.payment, order: this.state.order }] : [];
        }
        if (chain.table === eventoPedidos) return this.matches(predicate, this.state.order, chain.table) ? [this.state.order] : [];
        if (chain.table === eventoItensPedido) return this.matches(predicate, this.state.item, chain.table) ? [this.state.item] : [];
        if (chain.table === eventoReservas) return this.state.reservation.status === "ATIVA" && this.matches(predicate, this.state.reservation, chain.table) ? [this.state.reservation] : [];
        if (chain.table === eventoInventarioAssentos) return this.matches(predicate, this.state.inventory, chain.table) ? [this.state.inventory] : [];
        if (chain.table === eventoIngressos) return this.state.tickets.filter((ticket: any) => this.matches(predicate, ticket, chain.table));
        return [];
      },
    };
    return chain;
  }
  update(table: any) {
    const operation: any = { values: undefined, predicate: undefined, set: (values: any) => { operation.values = values; return operation; }, where: (predicate: any) => { operation.predicate = predicate; return operation; }, returning: async () => { const entity = table === eventoPagamentos ? this.state.payment : table === eventoInventarioAssentos ? this.state.inventory : table === eventoReservas ? this.state.reservation : this.state.order; if (operation.predicate && !this.matches(operation.predicate, entity, table)) return []; Object.assign(entity, operation.values); return [entity]; } };
    return operation;
  }
  matches(predicate: any, entity: any, table?: any): boolean {
    if (!predicate || !predicate.name) return true;
    if (predicate.name === "and") return predicate.args.every((item: any) => this.matches(item, entity, table));
    if (predicate.name === "or") return predicate.args.some((item: any) => this.matches(item, entity, table));
    if (!["eq", "lte", "inArray"].includes(predicate.name)) return true;

    const marker = predicate.args[0];
    const markerTable = marker?.__table;
    const markerColumn = marker?.__column;
    const expectedTable = this.tableName(table) ?? this.tableNameForEntity(entity);
    if (!markerTable || !markerColumn || (expectedTable && markerTable !== expectedTable)) return false;

    const source = expectedTable
      ? entity
      : entity?.[markerTable];
    if (!source) return false;
    const value = source[markerColumn];
    if (predicate.name === "eq") return value === predicate.args[1];
    if (predicate.name === "lte") return value instanceof Date && value <= predicate.args[1];
    return predicate.args[1]?.includes(value) ?? false;
  }
  private tableName(table: any): string | undefined {
    if (table === eventoPagamentos) return "eventoPagamentos";
    if (table === eventoPedidos) return "eventoPedidos";
    if (table === eventoItensPedido) return "eventoItensPedido";
    if (table === eventoReservas) return "eventoReservas";
    if (table === eventoInventarioAssentos) return "eventoInventarioAssentos";
    if (table === eventoIngressos) return "eventoIngressos";
    return undefined;
  }
  private tableNameForEntity(entity: any): string | undefined {
    if (entity === this.state.payment) return "eventoPagamentos";
    if (entity === this.state.order) return "eventoPedidos";
    if (entity === this.state.item) return "eventoItensPedido";
    if (entity === this.state.reservation) return "eventoReservas";
    if (entity === this.state.inventory) return "eventoInventarioAssentos";
    if (this.state.tickets.includes(entity)) return "eventoIngressos";
    return undefined;
  }
  insert(table: any) { const operation: any = { values: (values: any) => { operation.payload = values; return operation; }, returning: async () => { if (table === eventoIngressos) { this.state.tickets.push(operation.payload); return [operation.payload]; } return [{ id: "created-participant" }]; } }; return operation; }
}
