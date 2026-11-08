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

  it("envia ao Stripe as linhas persistidas do pedido com desconto e fecha em R$ 382,50", async () => {
    const createCheckoutSession = jest.fn().mockResolvedValue({ checkoutSessionId: "cs-38250", checkoutUrl: "https://checkout.example/cs-38250", paymentIntentId: "pi-38250" });
    const order = { id: "order-38250", orderNumber: "ABC123DEF456", status: "RESERVADO", totalCents: 38250, buyerName: "Ana", buyerEmail: "a@b.com", buyerPhone: "11999999999", expiresAt: new Date(Date.now() + 60_000), eventId: "event-1", sessionId: "session-1" };
    const rows = Array.from({ length: 10 }, (_, index) => ({ item: { id: `item-${index}`, orderId: order.id, ticketTypeId: "ticket-adulto", unitPriceCents: 3825, totalPriceCents: 3825, quantity: 1 }, ticket: { name: "Adulto" } }));
    const db = checkoutDb(order, rows);
    const result = await new EventosPublicSalesService({ db } as any, { createCheckoutSession } as any).iniciarCheckout("ABC123DEF456", { successUrl: "https://eventos.portalcef.com.br/sucesso", cancelUrl: "https://eventos.portalcef.com.br/cancelar", idempotencyKey: "checkout-38250" });

    expect(result).toMatchObject({ checkoutUrl: "https://checkout.example/cs-38250", orderNumber: order.orderNumber });
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ orderId: order.id, orderNumber: order.orderNumber, eventOrderId: order.id, totalAmount: 38250, items: expect.any(Array) }));
    const checkoutInput = createCheckoutSession.mock.calls[0][0];
    expect(checkoutInput.items).toHaveLength(10);
    expect(checkoutInput.items.reduce((sum: number, item: { unitAmount: number; quantity: number }) => sum + item.unitAmount * item.quantity, 0)).toBe(38250);
    expect(db.paymentPayload.expectedAmountCents).toBe(38250);
  });

  it("recusa linhas que não fecham o total persistido antes de chamar o Stripe", async () => {
    const createCheckoutSession = jest.fn();
    const order = { id: "order-divergente", orderNumber: "ABC123DEF456", status: "RESERVADO", totalCents: 38250, buyerName: "Ana", buyerEmail: "a@b.com", buyerPhone: "11999999999", expiresAt: new Date(Date.now() + 60_000), eventId: "event-1", sessionId: "session-1" };
    const rows = [{ item: { id: "item-1", orderId: order.id, ticketTypeId: "ticket-adulto", unitPriceCents: 4000, totalPriceCents: 4000, quantity: 10 }, ticket: { name: "Adulto" } }];
    const db = checkoutDb(order, rows);

    await expect(new EventosPublicSalesService({ db } as any, { createCheckoutSession } as any).iniciarCheckout("ABC123DEF456", { successUrl: "https://eventos.portalcef.com.br/sucesso", cancelUrl: "https://eventos.portalcef.com.br/cancelar", idempotencyKey: "checkout-divergente" })).rejects.toMatchObject({ response: { code: "CHECKOUT_AMOUNT_MISMATCH" } });
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(db.paymentPayload).toBeNull();
  });

  it("usa o preço persistido do ingresso e retorna itens da reserva", async () => {
    const db = vendaDb({ event: { id: "e1", status: "PUBLICADO" }, session: { id: "s1", status: "PUBLICADA" }, inventory: { id: "i1", status: "DISPONIVEL", seatId: "seat-1" }, ticket: { id: "t1", priceCents: 1250, maxPerOrder: 1, version: 1 } });
    const result = await new EventosPublicSalesService({ db } as any).reservarAssentos({ sessionId: "00000000-0000-4000-8000-000000000001", seats: [{ seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 }], buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" }, idempotencyKey: "price-123456" });
    expect(result.totalCents).toBe(1250);
    expect(result.subtotalCents).toBe(1250);
    expect(result.discountCents).toBe(0);
    expect(result.appliedOffer).toBeNull();
    expect(result.items).toHaveLength(1);
  });

  it("recusa assento duplicado antes de mutar pedido ou inventário", async () => {
    const db = vendaDbComIngressos({
      event: { id: "e1", status: "PUBLICADO" },
      session: { id: "s1", status: "PUBLICADA" },
      inventories: [{ id: "i1", status: "DISPONIVEL", seatId: "seat-1" }],
      ticket: { id: "t1", priceCents: 1250, maxPerOrder: null, version: 1 },
    });

    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos({
      sessionId: "00000000-0000-4000-8000-000000000001",
      seats: [
        { seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 },
        { seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 1 },
      ],
      buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" },
      idempotencyKey: "duplicate-seat-123456",
    })).rejects.toMatchObject({ response: { code: "DUPLICATE_SEAT" } });
    expect(db.mutations.value).toBe(0);
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

  it("aplica 15% a partir de 10 lugares, mas mantém 9 e aceita 20", async () => {
    const oferta = { id: uuid(90), version: 2, name: "Volume", pricingType: "PERCENTUAL", minQuantity: 10, maxQuantity: null, discountPercent: 15, priceCents: null, active: true };
    const fazer = async (quantidade: number, chave: string) => {
      const banco = criarBancoReserva({ quantidade, precoAdulto: 4500, offers: [oferta] });
      const resultado = await new EventosPublicSalesService({ db: banco } as any).reservarAssentos(entradaReserva(quantidade, chave));
      return { resultado, banco };
    };
    expect((await fazer(9, "volume-9-123456")).resultado).toMatchObject({ subtotalCents: 40500, discountCents: 0, totalCents: 40500, appliedOffer: null });
    expect((await fazer(10, "volume-10-123456")).resultado).toMatchObject({ subtotalCents: 45000, discountCents: 6750, totalCents: 38250, appliedOffer: { id: oferta.id, version: 2 } });
    const vinte = await fazer(20, "volume-20-123456");
    expect(vinte.resultado).toMatchObject({ subtotalCents: 90000, discountCents: 13500, totalCents: 76500 });
    expect(vinte.resultado.items).toHaveLength(20);
  });

  it("calcula o desconto sobre tipos mistos e preserva preço fixo legado como total da faixa", async () => {
    const ofertaPercentual = { id: uuid(91), version: 1, name: "Volume", pricingType: "PERCENTUAL", minQuantity: 10, maxQuantity: null, discountPercent: 15, priceCents: null, active: true };
    const misto = criarBancoReserva({ quantidade: 10, precoAdulto: 4500, precoCrianca: 2250, offers: [ofertaPercentual], tiposMistos: true });
    const resultadoMisto = await new EventosPublicSalesService({ db: misto } as any).reservarAssentos(entradaReserva(10, "misto-6-4-123456", true));
    expect(resultadoMisto).toMatchObject({ subtotalCents: 36000, discountCents: 5400, totalCents: 30600 });
    expect(resultadoMisto.items.reduce((total, item) => total + item.totalPriceCents, 0)).toBe(30600);

    const ofertaFixa = { id: uuid(92), version: 4, name: "Faixa legada", pricingType: "VALOR_FIXO", minQuantity: 10, maxQuantity: null, discountPercent: null, priceCents: 30000, active: true };
    const fixo = criarBancoReserva({ quantidade: 10, precoAdulto: 4500, offers: [ofertaFixa] });
    const resultadoFixo = await new EventosPublicSalesService({ db: fixo } as any).reservarAssentos(entradaReserva(10, "fixo-10-123456"));
    expect(resultadoFixo).toMatchObject({ subtotalCents: 45000, discountCents: 15000, totalCents: 30000 });
  });

  it("recusa total final inferior a R$ 1,00 antes de qualquer mutação", async () => {
    const banco = criarBancoReserva({ quantidade: 1, precoAdulto: 50, offers: [] });
    await expect(new EventosPublicSalesService({ db: banco } as any).reservarAssentos(entradaReserva(1, "minimo-123456"))).rejects.toMatchObject({ response: { code: "INVALID_AMOUNT" } });
    expect(banco.mutations.value).toBe(0);
  });

  it("repete a reserva idempotente com o snapshot persistido", async () => {
    const oferta = { id: uuid(93), version: 3, name: "Volume", pricingType: "PERCENTUAL", minQuantity: 2, maxQuantity: null, discountPercent: 15, priceCents: null, active: true };
    const banco = criarBancoReserva({ quantidade: 2, precoAdulto: 4500, offers: [oferta], repetir: true });
    const servico = new EventosPublicSalesService({ db: banco } as any);
    const entrada = entradaReserva(2, "idempotencia-123456");
    const primeira = await servico.reservarAssentos(entrada);
    banco.configuracaoAtual = [];
    const segunda = await servico.reservarAssentos(entrada);
    expect(segunda).toEqual(primeira);
    expect(segunda.appliedOffer).toMatchObject({ id: oferta.id, version: 3 });
  });

  it("rejeita a corrida de idempotência quando a reserva encontrada pertence a outro comprador", async () => {
    const existing = { id: "order-outro-comprador", orderNumber: "ABC123DEF456", buyerEmail: "outro@example.com", totalCents: 1250, expiresAt: new Date(Date.now() + 60_000) };
    let selectCalls = 0;
    const db: any = {
      transaction: async () => { throw { code: "23505", constraint: "uq_evento_pedidos_idempotency_key" }; },
      select: () => {
        const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => (selectCalls++ === 0 ? [existing] : []) };
        return chain;
      },
    };

    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos(entradaReserva(1, "corrida-email-123456"))).rejects.toMatchObject({
      response: { code: "IDEMPOTENCY_CONFLICT" },
    });
  });

  it("preserva o replay da corrida de idempotência para o mesmo comprador", async () => {
    const existing = { id: "order-proprio", orderNumber: "ABC123DEF456", buyerEmail: "A@B.COM", totalCents: 1250, expiresAt: new Date(Date.now() + 60_000) };
    let selectCalls = 0;
    const db: any = {
      transaction: async () => { throw { code: "23505", constraint: "uq_evento_pedidos_idempotency_key" }; },
      select: () => {
        const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => (selectCalls++ === 0 ? [existing] : []) };
        return chain;
      },
    };

    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos(entradaReserva(1, "corrida-email-proprio"))).resolves.toMatchObject({
      reservationId: existing.id,
      orderNumber: existing.orderNumber,
    });
  });

  it("trata a colisão do INSERT interno com comprador diferente fora da transação abortada", async () => {
    const banco = criarBancoReservaComColisao("outro@example.com");

    await expect(new EventosPublicSalesService({ db: banco } as any).reservarAssentos(entradaReserva(1, "colisao-interna-outro-123456"))).rejects.toMatchObject({
      response: { code: "IDEMPOTENCY_CONFLICT" },
    });
    expect(banco.colisao.insertAttempts).toBe(1);
  });

  it("repete o snapshot quando a colisão do INSERT interno pertence ao mesmo comprador", async () => {
    const banco = criarBancoReservaComColisao("A@B.COM");

    await expect(new EventosPublicSalesService({ db: banco } as any).reservarAssentos(entradaReserva(1, "colisao-interna-proprio-123456"))).resolves.toMatchObject({
      reservationId: banco.colisao.order.id,
      orderNumber: banco.colisao.order.orderNumber,
    });
    expect(banco.colisao.insertAttempts).toBe(1);
  });

  it("explicita a ambiguidade quando existem várias ofertas ativas no evento", async () => {
    const ofertas = [
      { id: uuid(94), version: 1, name: "Dez", pricingType: "PERCENTUAL", minQuantity: 10, maxQuantity: null, discountPercent: 15, priceCents: null, active: true },
      { id: uuid(95), version: 2, name: "Vinte", pricingType: "PERCENTUAL", minQuantity: 20, maxQuantity: null, discountPercent: 20, priceCents: null, active: true },
    ];
    const banco = criarBancoReserva({ quantidade: 10, precoAdulto: 4500, offers: ofertas });

    await expect(new EventosPublicSalesService({ db: banco } as any).reservarAssentos(entradaReserva(10, "oferta-ambigua-123456"))).rejects.toMatchObject({
      response: { code: "MULTIPLE_ACTIVE_OFFERS" },
    });
  });
});

function uuid(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function entradaReserva(quantidade: number, idempotencyKey: string, misto = false) {
  return {
    sessionId: uuid(1),
    seats: Array.from({ length: quantidade }, (_, index) => ({ seatId: uuid(100 + index), ticketTypeId: uuid(misto && index >= 6 ? 3 : 2), participantIndex: index })),
    buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" },
    idempotencyKey,
  };
}

function criarBancoReservaComColisao(buyerEmail: string) {
  return criarBancoReserva({ quantidade: 1, precoAdulto: 1250, offers: [], colisao: { buyerEmail } });
}

function criarBancoReserva(config: { quantidade: number; precoAdulto: number; precoCrianca?: number; offers: any[]; tiposMistos?: boolean; repetir?: boolean; colisao?: { buyerEmail: string } }) {
  const event = { id: uuid(10), status: "PUBLICADO" };
  const session = { id: uuid(1), status: "PUBLICADA" };
  const tickets = [
    { id: uuid(2), eventId: event.id, priceCents: config.precoAdulto, maxPerOrder: null, version: 1, active: true },
    { id: uuid(3), eventId: event.id, priceCents: config.precoCrianca ?? config.precoAdulto, maxPerOrder: null, version: 1, active: true },
  ];
  const inventories = Array.from({ length: config.quantidade }, (_, index) => ({ id: uuid(200 + index), sessionId: session.id, seatId: uuid(100 + index), status: "DISPONIVEL" }));
  const order: any = { id: uuid(500), orderNumber: "ABC123DEF456", eventId: event.id, sessionId: session.id, buyerEmail: "a@b.com", expiresAt: new Date(Date.now() + 60_000) };
  const itemRows: any[] = [];
  let selectCalls = 0;
  let insertCalls = 0;
  let inTransaction = false;
  let transactionAborted = false;
  let externalCollisionLookupDone = false;
  const collisionOrder: any = { id: uuid(501), orderNumber: "COLISAO123456", eventId: event.id, sessionId: session.id, buyerEmail: config.colisao?.buyerEmail, totalCents: config.precoAdulto, expiresAt: new Date(Date.now() + 60_000) };
  const mutations = { value: 0 };
  const banco: any = {
    mutations,
    colisao: { order: collisionOrder, insertAttempts: 0 },
    configuracaoAtual: config.offers,
    transaction: async (fn: any) => {
      inTransaction = true;
      transactionAborted = false;
      try {
        return await fn(banco);
      } finally {
        inTransaction = false;
      }
    },
    select: () => {
      if (inTransaction && transactionAborted) throw { code: "25P02", message: "current transaction is aborted" };
      const index = selectCalls++;
      let value: any[] = [];
      if (config.colisao && !inTransaction && !externalCollisionLookupDone) {
        externalCollisionLookupDone = true;
        value = [collisionOrder];
      } else if (config.repetir && banco.jaCriado && index >= 7) {
        value = index === 7 ? [order] : itemRows.map((item) => ({ item, inventory: inventories.find((inventory) => inventory.id === item.inventorySeatId) }));
      } else if (index === 0) value = [];
      else if (index === 1) value = [{ event, session }];
      else if (index >= 2 && index < 2 + (config.tiposMistos ? 2 : 1)) value = [tickets[index - 2]];
      else if (index >= 2 + (config.tiposMistos ? 2 : 1) && index < 2 + (config.tiposMistos ? 2 : 1) + config.quantidade) value = [inventories[index - (2 + (config.tiposMistos ? 2 : 1))]];
      else if (index === 2 + (config.tiposMistos ? 2 : 1) + config.quantidade) value = banco.configuracaoAtual;
      else value = itemRows.map((item) => ({ item, inventory: inventories.find((inventory) => inventory.id === item.inventorySeatId) }));
      const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => value, orderBy: async () => value };
      return chain;
    },
    insert: () => {
      mutations.value += 1;
      insertCalls += 1;
      return { values: (payload: any) => {
        if (config.colisao && !banco.jaCriado && !payload.ticketTypeId) {
          banco.colisao.insertAttempts += 1;
          transactionAborted = true;
          throw { code: "23505", constraint: "uq_evento_pedidos_idempotency_key" };
        }
        if (insertCalls === 1) { Object.assign(order, payload); banco.jaCriado = true; return { returning: async () => [order] }; }
        if (insertCalls >= 3 && payload.ticketTypeId) itemRows.push(payload);
        return Promise.resolve([]);
      } };
    },
    update: () => { mutations.value += 1; return { set: () => ({ where: () => ({ returning: async () => [{}] }) }) }; },
  };
  return banco;
}

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

function checkoutDb(order: any, rows: any[]) {
  let selects = 0;
  const db: any = {
    paymentPayload: null,
    select: () => {
      const value = selects++ === 0 ? [{ order, event: { id: order.eventId, status: "PUBLICADO", title: "Evento" }, session: { id: order.sessionId, status: "PUBLICADA" } }] : selects === 2 ? rows : [];
      const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => value };
      return chain;
    },
    insert: (_table: any) => ({ values: (payload: any) => { db.paymentPayload = payload; return Promise.resolve([]); } }),
    update: () => ({ set: (payload: any) => ({ where: async () => { if (payload.expectedAmountCents !== undefined) db.paymentPayload = payload; return []; } }) }),
  };
  return db;
}
