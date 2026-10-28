import { EventosPublicSalesService } from "./eventos-public-sales.service";

describe("EventosPublicSalesService - contratos públicos", () => {
  const service = () => new EventosPublicSalesService({ db: {} } as any);

  it("rejeita campos extras, UUID inválido e chave curta em runtime", async () => {
    await expect(service().reservarAssentos({ sessionId: "s1", seats: [], buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" }, idempotencyKey: "curta", schoolId: "attacker" })).rejects.toMatchObject({ response: { code: "VALIDATION_ERROR" } });
  });

  it("exige os cinco aceites e índices completos sem duplicação", async () => {
    await expect(service().finalizarPedidoConvidado("ABC123DEF456", { participants: [{ participantIndex: 0, fullName: "Ana", type: "CONVIDADO" }], acceptances: [{ type: "COMPRA", version: 1 }], idempotencyKey: "final-123456" })).rejects.toMatchObject({ response: { code: "VALIDATION_ERROR" } });
  });

  it("falha fechado no checkout e nunca devolve URL do cliente", async () => {
    await expect(service().iniciarCheckout("ABC123DEF456", { successUrl: "https://ok.example/sucesso", cancelUrl: "https://ok.example/cancelar", idempotencyKey: "checkout-123456" })).rejects.toMatchObject({ response: { code: "CHECKOUT_UNAVAILABLE" } });
  });

  it("usa o preço persistido do ingresso e retorna itens da reserva", async () => {
    const db = vendaDb({ event: { id: "e1", status: "PUBLICADO" }, session: { id: "s1", status: "PUBLICADA" }, inventory: { id: "i1", status: "DISPONIVEL", seatId: "seat-1" }, ticket: { id: "t1", priceCents: 1250, maxPerOrder: 1, version: 1 } });
    const result = await new EventosPublicSalesService({ db } as any).reservarAssentos({ sessionId: "00000000-0000-4000-8000-000000000001", seats: [{ seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 }], buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" }, idempotencyKey: "price-123456" });
    expect(result.totalCents).toBe(1250);
    expect(result.items).toHaveLength(1);
  });

  it("rejeita excesso por tipo de ingresso antes de mutar inventário ou pedido", async () => {
    const db = vendaDbComIngressos({
      event: { id: "e1", status: "PUBLICADO" },
      session: { id: "s1", status: "PUBLICADA" },
      inventories: [
        { id: "i1", status: "DISPONIVEL", seatId: "seat-1" },
        { id: "i2", status: "DISPONIVEL", seatId: "seat-2" },
      ],
      ticket: { id: "t1", priceCents: 1250, maxPerOrder: 1, version: 1 },
    });

    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos({
      sessionId: "00000000-0000-4000-8000-000000000001",
      seats: [
        { seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 },
        { seatId: "00000000-0000-4000-8000-000000000004", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 1 },
      ],
      buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" },
      idempotencyKey: "ticket-limit-123456",
    })).rejects.toMatchObject({ response: { code: "TICKET_LIMIT_EXCEEDED" } });
    expect(db.mutations.value).toBe(0);
  });

  it("permite a quantidade igual ao limite do tipo de ingresso", async () => {
    const db = vendaDbComIngressos({
      event: { id: "e1", status: "PUBLICADO" },
      session: { id: "s1", status: "PUBLICADA" },
      inventories: [{ id: "i1", status: "DISPONIVEL", seatId: "seat-1" }],
      ticket: { id: "t1", priceCents: 1250, maxPerOrder: 1, version: 1 },
    });

    const result = await new EventosPublicSalesService({ db } as any).reservarAssentos({
      sessionId: "00000000-0000-4000-8000-000000000001",
      seats: [{ seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 }],
      buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" },
      idempotencyKey: "ticket-limit-ok-123456",
    });
    expect(result.items).toHaveLength(1);
  });

  it("rejeita sessão não publicada", async () => {
    const db = vendaDb({ event: { id: "e1", status: "PUBLICADO" }, session: null });
    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos({ sessionId: "00000000-0000-4000-8000-000000000001", seats: [{ seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 }], buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" }, idempotencyKey: "session-123456" })).rejects.toMatchObject({ response: { code: "EVENT_NOT_FOUND" } });
  });

  it("repete a finalização idempotente mesmo após expiração do pedido", async () => {
    const order = {
      id: "order-1",
      orderNumber: "ABC123DEF456",
      eventId: "event-1",
      sessionId: "session-1",
      status: "EXPIRADO",
      totalCents: 1250,
      expiresAt: new Date(Date.now() - 60_000),
      finalizationIdempotencyKey: "final-123456",
    };
    const db: any = {
      transaction: async (fn: any) => fn(db),
      select: () => {
        const call = db.selectCalls++;
        const values = [
          [{ order, event: { id: "event-1", status: "PUBLICADO", title: "Evento" }, session: { id: "session-1", status: "PUBLICADA", startsAt: new Date("2026-11-01T10:00:00Z"), endsAt: new Date("2026-11-01T12:00:00Z") } }],
          [order],
          [{ item: { ticketTypeId: "ticket-1", unitPriceCents: 1250, totalPriceCents: 1250 }, inventory: { seatId: "seat-1" } }],
        ];
        const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => values[call] ?? [] };
        return chain;
      },
      selectCalls: 0,
    };

    await expect(new EventosPublicSalesService({ db } as any).finalizarPedidoConvidado("ABC123DEF456", {
      participants: [{ participantIndex: 0, fullName: "Ana", type: "CONVIDADO" }],
      acceptances: [
        { type: "PRIVACIDADE", version: 1 },
        { type: "COMPRA", version: 1 },
        { type: "CANCELAMENTO_REEMBOLSO", version: 1 },
        { type: "ACESSIBILIDADE", version: 1 },
        { type: "CONTATO", version: 1 },
      ],
      idempotencyKey: "final-123456",
    })).resolves.toMatchObject({
      orderNumber: "ABC123DEF456",
      status: "EXPIRADO",
      eventTitle: "Evento",
      totalCents: 1250,
      items: [{ seatId: "seat-1", ticketTypeId: "ticket-1", totalPriceCents: 1250 }],
    });
  });

  it("rejeita successUrl/cancelUrl fora da origem pública configurada", () => {
    const service = new EventosPublicSalesService({ db: {} } as any, {} as any);
    expect(() => (service as any).validarUrlCheckout("https://evil.example/retorno")).toThrow();
  });
});

function vendaDb(data: any) {
  let selects = 0;
  const order = { id: "order-1", orderNumber: "ABC123DEF456", totalCents: data.ticket?.priceCents ?? 0, expiresAt: new Date(Date.now() + 60_000), buyerEmail: "a@b.com" };
  const rows = [[], data.session ? [{ event: data.event, session: data.session }] : [], data.ticket ? [data.ticket] : [], data.inventory ? [data.inventory] : [], [], [{ item: { ticketTypeId: data.ticket?.id, unitPriceCents: data.ticket?.priceCents, totalPriceCents: data.ticket?.priceCents }, inventory: data.inventory }]];
  const db: any = { transaction: async (fn: any) => fn(db), select: () => { const value = rows[selects++] ?? []; const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => value, orderBy: async () => value }; return chain; }, insert: () => ({ values: () => ({ returning: async () => [order] }) }), update: () => ({ set: () => ({ where: () => ({ returning: async () => [{}] }) }) }) };
  return db;
}

function vendaDbComIngressos(data: any) {
  let selects = 0;
  const mutations = { value: 0 };
  const order = { id: "order-1", orderNumber: "ABC123DEF456", totalCents: data.ticket.priceCents, expiresAt: new Date(Date.now() + 60_000), buyerEmail: "a@b.com" };
  const rows = [
    [],
    [{ event: data.event, session: data.session }],
    [data.ticket],
    ...(data.inventories ?? []).map((inventory: any) => [inventory]),
    [],
    [{ item: { ticketTypeId: data.ticket.id, unitPriceCents: data.ticket.priceCents, totalPriceCents: data.ticket.priceCents }, inventory: data.inventories?.[0] }],
  ];
  const db: any = {
    mutations,
    transaction: async (fn: any) => fn(db),
    select: () => {
      const value = rows[selects++] ?? [];
      const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => value, orderBy: async () => value };
      return chain;
    },
    insert: () => { mutations.value += 1; return { values: () => ({ returning: async () => [order] }) }; },
    update: () => { mutations.value += 1; return { set: () => ({ where: () => ({ returning: async () => [{}] }) }) }; },
  };
  return db;
}
