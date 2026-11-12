import { EventosPublicSalesService } from "./eventos-public-sales.service";
import { eventoAceites, eventoIngressos, eventoInventarioAssentos, eventoItensPedido, eventoOfertas, eventoPagamentos, eventoPedidos, eventoParticipantes, eventoPoliticas, eventoReservas, eventoSessoes, eventoTiposIngresso, eventoTokensConsulta, eventos, schema } from "@essencia/db";
import { hashTokenAcesso } from "./acesso-pedido";

describe("EventosPublicSalesService - contratos públicos", () => {
  const service = () => new EventosPublicSalesService({ db: {} } as any);

  it("bloqueia apenas pedido, evento e sessão ao ler pedido com local opcional", async () => {
    const locks: Array<{ strength: string; config?: { of?: unknown[] } }> = [];
    const query = {
      for: async (strength: string, config?: { of?: unknown[] }) => {
        locks.push({ strength, config });
        return [];
      },
    };

    await (service() as any).lockRows(query, [eventoPedidos, eventos, eventoSessoes]);

    expect(locks).toHaveLength(1);
    expect(locks[0]?.strength).toBe("update");
    expect(locks[0]?.config?.of).toEqual(expect.arrayContaining([eventoPedidos, eventos, eventoSessoes]));
  });

  it("rejeita campos extras, UUID inválido e chave curta em runtime", async () => {
    await expect(service().reservarAssentos({ sessionId: "s1", seats: [], buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" }, idempotencyKey: "curta", schoolId: "attacker" })).rejects.toMatchObject({ response: { code: "VALIDATION_ERROR" } });
  });

  it("exige os cinco aceites e índices completos sem duplicação", async () => {
    await expect(service().finalizarPedidoConvidado("ABC123DEF456", { participants: [{ participantIndex: 0, fullName: "Ana", type: "CONVIDADO" }], acceptances: [{ type: "COMPRA", version: 1 }], idempotencyKey: "final-123456" })).rejects.toMatchObject({ response: { code: "VALIDATION_ERROR" } });
  });

  it("falha fechado no checkout e nunca devolve URL do cliente", async () => {
    await expect(service().iniciarCheckout("ABC123DEF456", { returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno", idempotencyKey: "checkout-123456" })).rejects.toMatchObject({ response: { code: "CHECKOUT_UNAVAILABLE" } });
  });

  it("libera assentos, reservas, pagamento e cancela o pedido", async () => {
    const db = liberarPedidoDb({
      order: { id: "order-liberar", orderNumber: "ABC123DEF456", status: "AGUARDANDO_PAGAMENTO" },
      payment: { id: "payment-1", orderId: "order-liberar", status: "PENDENTE", stripeCheckoutSessionId: null },
      inventories: [{ id: "inventory-1", status: "RESERVADO", reservedByOrderId: "order-liberar" }],
      reservations: [{ id: "reservation-1", orderId: "order-liberar", status: "ATIVA" }],
    });

    await expect(new EventosPublicSalesService({ db } as any).liberarPedido("ABC123DEF456")).resolves.toEqual({ liberado: true });
    expect(db.inventory[0]).toMatchObject({ status: "DISPONIVEL", reservedByOrderId: null, reservationExpiresAt: null });
    expect(db.reservations[0]).toMatchObject({ status: "LIBERADA", releasedAt: expect.any(Date) });
    expect(db.payment).toMatchObject({ status: "EXPIRADO" });
    expect(db.order).toMatchObject({ status: "CANCELADO", cancellationReason: "Lugares liberados pelo comprador" });
  });

  it("recusa sem mutar quando a Stripe diz que o pagamento foi concluído", async () => {
    const db = liberarPedidoDb({
      order: { id: "order-pago", orderNumber: "ABC123DEF456", status: "AGUARDANDO_PAGAMENTO" },
      payment: { id: "payment-pago", orderId: "order-pago", status: "PENDENTE", stripeCheckoutSessionId: "cs_pago" },
      inventories: [{ id: "inventory-pago", status: "RESERVADO", reservedByOrderId: "order-pago" }],
      reservations: [{ id: "reservation-pago", orderId: "order-pago", status: "ATIVA" }],
    });
    const payments = { encerrarCheckoutSessionSeAberta: jest.fn().mockResolvedValue("concluida") };

    await expect(new EventosPublicSalesService({ db } as any, payments as any).liberarPedido("ABC123DEF456")).rejects.toMatchObject({ response: { code: "PAYMENT_ALREADY_COMPLETED" } });
    expect(payments.encerrarCheckoutSessionSeAberta).toHaveBeenCalledWith("cs_pago");
    expect(db.mutations).toBe(0);
  });

  it("recusa pedido confirmado", async () => {
    const db = liberarPedidoDb({ order: { id: "order-confirmado", orderNumber: "ABC123DEF456", status: "CONFIRMADO" } });

    await expect(new EventosPublicSalesService({ db } as any).liberarPedido("ABC123DEF456")).rejects.toMatchObject({ response: { code: "PAYMENT_ALREADY_COMPLETED" } });
    expect(db.mutations).toBe(0);
  });

  it("repetir a liberação de pedido cancelado não muda nada", async () => {
    const db = liberarPedidoDb({ order: { id: "order-cancelado", orderNumber: "ABC123DEF456", status: "CANCELADO" } });

    await expect(new EventosPublicSalesService({ db } as any).liberarPedido("ABC123DEF456")).resolves.toEqual({ liberado: true });
    expect(db.mutations).toBe(0);
  });

  it("não cancela pedido quando uma confirmação ocorre durante a transação", async () => {
    const db = liberarPedidoDb({
      order: { id: "order-corrida", orderNumber: "ABC123DEF456", status: "AGUARDANDO_PAGAMENTO" },
      payment: { id: "payment-corrida", orderId: "order-corrida", status: "PENDENTE", stripeCheckoutSessionId: null },
      inventories: [{ id: "inventory-corrida", status: "RESERVADO", reservedByOrderId: "order-corrida" }],
      reservations: [{ id: "reservation-corrida", orderId: "order-corrida", status: "ATIVA" }],
      onTransactionOrderRead: () => {
        db.order.status = "CONFIRMADO";
        db.payment.status = "APROVADO";
        db.inventory[0].status = "VENDIDO";
        db.reservations[0].status = "CONVERTIDA";
      },
    });

    await expect(new EventosPublicSalesService({ db } as any).liberarPedido("ABC123DEF456")).rejects.toMatchObject({ response: { code: "PAYMENT_ALREADY_COMPLETED" } });
    expect(db.order.status).toBe("CONFIRMADO");
    expect(db.mutations).toBe(0);
    expect(db.lockedReads).toBeGreaterThan(0);
  });

  it("reconhece resultado postgres-js com count de uma linha afetada", () => {
    const service = new EventosPublicSalesService({ db: {} } as any);
    expect((service as any).updatedExactlyOne(Object.assign([], { count: 1 }))).toBe(true);
  });

  it("envia ao Stripe as linhas persistidas do pedido com desconto e fecha em R$ 382,50", async () => {
    const createEmbeddedCheckoutSession = jest.fn().mockResolvedValue({ checkoutSessionId: "cs-38250", clientSecret: "cs_secret_38250", paymentIntentId: "pi-38250" });
    const order = { id: "order-38250", orderNumber: "ABC123DEF456", status: "RESERVADO", totalCents: 38250, buyerName: "Ana", buyerEmail: "a@b.com", buyerPhone: "11999999999", expiresAt: new Date(Date.now() + 60_000), eventId: "event-1", sessionId: "session-1" };
    const rows = Array.from({ length: 10 }, (_, index) => ({ item: { id: `item-${index}`, orderId: order.id, ticketTypeId: "ticket-adulto", unitPriceCents: 3825, totalPriceCents: 3825, quantity: 1 }, ticket: { name: "Adulto" } }));
    const db = checkoutDb(order, rows);
    const result = await new EventosPublicSalesService({ db } as any, { createEmbeddedCheckoutSession } as any).iniciarCheckout("ABC123DEF456", { returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno", idempotencyKey: "checkout-38250" });

    expect(result).toMatchObject({ clientSecret: "cs_secret_38250", orderNumber: order.orderNumber });
    expect(createEmbeddedCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ orderId: order.id, orderNumber: order.orderNumber, eventOrderId: order.id, totalAmount: 38250, items: expect.any(Array), returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno", idempotencyKey: `evento-checkout:${order.id}:checkout-38250` }));
    const checkoutInput = createEmbeddedCheckoutSession.mock.calls[0][0];
    expect(checkoutInput.items).toHaveLength(10);
    expect(checkoutInput.items.reduce((sum: number, item: { unitAmount: number; quantity: number }) => sum + item.unitAmount * item.quantity, 0)).toBe(38250);
    expect(db.paymentPayload.expectedAmountCents).toBe(38250);
  });

  it("recusa linhas que não fecham o total persistido antes de chamar o Stripe", async () => {
    const createEmbeddedCheckoutSession = jest.fn();
    const order = { id: "order-divergente", orderNumber: "ABC123DEF456", status: "RESERVADO", totalCents: 38250, buyerName: "Ana", buyerEmail: "a@b.com", buyerPhone: "11999999999", expiresAt: new Date(Date.now() + 60_000), eventId: "event-1", sessionId: "session-1" };
    const rows = [{ item: { id: "item-1", orderId: order.id, ticketTypeId: "ticket-adulto", unitPriceCents: 4000, totalPriceCents: 4000, quantity: 10 }, ticket: { name: "Adulto" } }];
    const db = checkoutDb(order, rows);

    await expect(new EventosPublicSalesService({ db } as any, { createEmbeddedCheckoutSession } as any).iniciarCheckout("ABC123DEF456", { returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno", idempotencyKey: "checkout-divergente" })).rejects.toMatchObject({ response: { code: "CHECKOUT_AMOUNT_MISMATCH" } });
    expect(createEmbeddedCheckoutSession).not.toHaveBeenCalled();
    expect(db.paymentPayload).toBeNull();
  });

  it("recusa returnUrl de outra origem com CHECKOUT_URL_NOT_ALLOWED", async () => {
    const createEmbeddedCheckoutSession = jest.fn();
    const order = { id: "order-url", orderNumber: "ABC123DEF456", status: "RESERVADO", totalCents: 1250, buyerName: "Ana", buyerEmail: "a@b.com", buyerPhone: "11999999999", expiresAt: new Date(Date.now() + 60_000), eventId: "event-1", sessionId: "session-1" };
    const db = checkoutDb(order, [{ item: { ticketTypeId: "ticket-adulto", unitPriceCents: 1250, quantity: 1 }, ticket: { name: "Adulto" } }]);

    await expect(new EventosPublicSalesService({ db } as any, { createEmbeddedCheckoutSession } as any).iniciarCheckout("ABC123DEF456", { returnUrl: "https://evil.example/pagamento/retorno", idempotencyKey: "checkout-url-123456" })).rejects.toMatchObject({ response: { code: "CHECKOUT_URL_NOT_ALLOWED" } });
    expect(createEmbeddedCheckoutSession).not.toHaveBeenCalled();
  });

  it("recusa pedido não finalizado sem e-mail do comprador", async () => {
    const createEmbeddedCheckoutSession = jest.fn();
    const order = { id: "order-sem-email", orderNumber: "ABC123DEF456", status: "RESERVADO", totalCents: 1250, buyerName: "Ana", buyerEmail: null, buyerPhone: "11999999999", expiresAt: new Date(Date.now() + 60_000), eventId: "event-1", sessionId: "session-1" };
    const db = checkoutDb(order, []);

    await expect(new EventosPublicSalesService({ db } as any, { createEmbeddedCheckoutSession } as any).iniciarCheckout("ABC123DEF456", { returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno", idempotencyKey: "checkout-email-123456" })).rejects.toMatchObject({ response: { code: "ORDER_NOT_FINALIZED" } });
    expect(createEmbeddedCheckoutSession).not.toHaveBeenCalled();
  });

  it("reaproveita a sessão aberta sem criar outra", async () => {
    const createEmbeddedCheckoutSession = jest.fn();
    const obterClientSecretSeAberta = jest.fn().mockResolvedValue("cs_secret_existente");
    const order = { id: "order-reuso", orderNumber: "ABC123DEF456", status: "AGUARDANDO_PAGAMENTO", totalCents: 1250, buyerName: "Ana", buyerEmail: "a@b.com", buyerPhone: "11999999999", expiresAt: new Date(Date.now() + 60_000), eventId: "event-1", sessionId: "session-1" };
    const db = checkoutDb(order, [{ item: { ticketTypeId: "ticket-adulto", unitPriceCents: 1250, quantity: 1 }, ticket: { name: "Adulto" } }], { id: "payment-existente", orderId: order.id, status: "PENDENTE", stripeCheckoutSessionId: "cs_existente" });

    await expect(new EventosPublicSalesService({ db } as any, { createEmbeddedCheckoutSession, obterClientSecretSeAberta } as any).iniciarCheckout("ABC123DEF456", { returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno", idempotencyKey: "checkout-reuso-123456" })).resolves.toMatchObject({ clientSecret: "cs_secret_existente", orderNumber: order.orderNumber });
    expect(obterClientSecretSeAberta).toHaveBeenCalledWith("cs_existente");
    expect(createEmbeddedCheckoutSession).not.toHaveBeenCalled();
  });

  it("serializa duas abas de checkout e cria uma única sessão Stripe", async () => {
    const createEmbeddedCheckoutSession = jest.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { checkoutSessionId: "cs-unica", clientSecret: "cs_secret_unica", paymentIntentId: "pi-unico" };
    });
    const order = { id: "order-concorrente", orderNumber: "ABC123DEF456", status: "RESERVADO", totalCents: 1250, buyerName: "Ana", buyerEmail: "a@b.com", buyerPhone: "11999999999", expiresAt: new Date(Date.now() + 60_000), eventId: "event-1", sessionId: "session-1" };
    const db = checkoutConcorrenteDb(order);
    const service = new EventosPublicSalesService({ db } as any, { createEmbeddedCheckoutSession, obterClientSecretSeAberta: jest.fn().mockResolvedValue("cs_secret_unica") } as any);

    const results = await Promise.all([
      service.iniciarCheckout(order.orderNumber, { returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno", idempotencyKey: "checkout-aba-um-123456" }),
      service.iniciarCheckout(order.orderNumber, { returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno", idempotencyKey: "checkout-aba-dois-123456" }),
    ]);

    expect(results[0]).toMatchObject({ clientSecret: "cs_secret_unica" });
    expect(results[1]).toMatchObject({ clientSecret: "cs_secret_unica" });
    expect(createEmbeddedCheckoutSession).toHaveBeenCalledTimes(1);
    expect(db.payments).toHaveLength(1);
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

  it("reserva sem dados do comprador grava comprador nulo", async () => {
    const db = criarBancoReserva({ quantidade: 1, precoAdulto: 1250, offers: [] });

    await new EventosPublicSalesService({ db } as any).reservarAssentos(entradaReserva(1, "buyer-nulo-123456", false, false));

    expect(db.order).toMatchObject({ buyerName: null, buyerEmail: null, buyerPhone: null });
  });

  it("reserva ignora buyer enviado e grava comprador nulo", async () => {
    const db = criarBancoReserva({ quantidade: 1, precoAdulto: 1250, offers: [] });
    const input = entradaReserva(1, "buyer-ignorado-123456");
    input.buyer = { name: "Pessoa Enviada", email: "enviado@example.com", phone: "11999999999" };

    await new EventosPublicSalesService({ db } as any).reservarAssentos(input);

    expect(db.order).toMatchObject({ buyerName: null, buyerEmail: null, buyerPhone: null });
  });

  it("libera a reserva antiga e expira o pedido ao tomar assento vencido", async () => {
    const db = criarBancoReserva({ quantidade: 1, precoAdulto: 1250, offers: [], takeover: true });

    await new EventosPublicSalesService({ db } as any).reservarAssentos(entradaReserva(1, "takeover-123456", false, true));

    expect(db.oldReservation).toMatchObject({ status: "LIBERADA", releasedAt: expect.any(Date) });
    expect(db.oldOrder).toMatchObject({ status: "EXPIRADO" });
  });

  it("libera todos os assentos do pedido antigo no takeover multiassento", async () => {
    const db = criarBancoReserva({ quantidade: 2, precoAdulto: 1250, offers: [], takeover: true, takeoverMultiassento: true });

    await new EventosPublicSalesService({ db } as any).reservarAssentos(entradaReserva(1, "takeover-multi-123456", false, true));

    expect(db.inventariosAntigos).toHaveLength(2);
    expect(db.inventariosAntigos.every((inventory: any) => inventory.status === "DISPONIVEL" && inventory.reservedByOrderId === null)).toBe(true);
    expect(db.reservasAntigas.every((reservation: any) => reservation.status === "LIBERADA")).toBe(true);
    expect(db.oldOrder).toMatchObject({ status: "EXPIRADO" });
    expect(db.pagamentoAntigo).toMatchObject({ status: "EXPIRADO" });
  });

  it("trata inventário LIBERADO como disponível para nova reserva", async () => {
    const db = criarBancoReserva({ quantidade: 1, precoAdulto: 1250, offers: [], statusInicial: "LIBERADO" });

    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos(entradaReserva(1, "liberado-disponivel-123456"))).resolves.toMatchObject({ reservationId: db.order.id });
  });

  it("recusa repetição idempotente com outros assentos na mesma sessão", async () => {
    const db = criarBancoReserva({ quantidade: 1, precoAdulto: 1250, offers: [], repetir: true });
    const service = new EventosPublicSalesService({ db } as any);
    await service.reservarAssentos(entradaReserva(1, "idempotencia-assento-123456"));
    const repeticao = entradaReserva(1, "idempotencia-assento-123456");
    repeticao.seats[0]!.seatId = uuid(999);

    await expect(service.reservarAssentos(repeticao)).rejects.toMatchObject({ response: { code: "IDEMPOTENCY_CONFLICT" } });
  });

  it("recusa repetição idempotente quando tipo ou participantIndex mudam", async () => {
    const db = criarBancoReserva({ quantidade: 2, precoAdulto: 1250, precoCrianca: 900, offers: [], repetir: true });
    const service = new EventosPublicSalesService({ db } as any);
    const original = entradaReserva(2, "idempotencia-carga-123456", true);
    await service.reservarAssentos(original);

    const repeticao = entradaReserva(2, "idempotencia-carga-123456", true);
    repeticao.seats[0]!.ticketTypeId = uuid(3);
    repeticao.seats[0]!.participantIndex = 1;
    repeticao.seats[1]!.participantIndex = 0;

    await expect(service.reservarAssentos(repeticao)).rejects.toMatchObject({ response: { code: "IDEMPOTENCY_CONFLICT" } });
  });

  it("recusa a colisão de idempotência com outros assentos no caminho de corrida", async () => {
    const db = corridaIdempotenciaDb({ seatId: uuid(300) });
    const input = entradaReserva(1, "idempotencia-corrida-assento-123456");
    input.seats[0]!.seatId = uuid(301);

    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos(input)).rejects.toMatchObject({ response: { code: "IDEMPOTENCY_CONFLICT" } });
  });

  it("finalização grava comprador normalizado e usa o nome nos aceites", async () => {
    const db = pedidoFinalizacaoDb();

    await new EventosPublicSalesService({ db } as any).finalizarPedidoConvidado("ABC123DEF456", entradaFinalizacao());

    expect(db.order).toMatchObject({ buyerName: "Ana Maria", buyerEmail: "ana@example.com", buyerPhone: "5511999999999" });
    expect(db.acceptances).toHaveLength(5);
    expect(db.acceptances.every((acceptance: any) => acceptance.acceptedByName === "Ana Maria" && acceptance.acceptedByEmail === "ana@example.com")).toBe(true);
  });

  it("finalização devolve acesso e guarda só o hash com validade de 30 dias após o fim da sessão", async () => {
    const db = pedidoFinalizacaoDb();
    const result = await new EventosPublicSalesService({ db } as any).finalizarPedidoConvidado("ABC123DEF456", entradaFinalizacao());
    const token = db.tokens[0];

    expect(result).toHaveProperty("pedido");
    expect(result.acesso).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).toMatchObject({ orderId: db.order.id, email: "ana@example.com", expiresAt: new Date("2027-01-06T12:00:00Z") });
    expect(token).not.toHaveProperty("token");
    expect(token.tokenHash).toBe(hashTokenAcesso(result.acesso));
  });

  it("reaproveita uma finalização existente após reload sem duplicar aceites ou participantes", async () => {
    const db = pedidoFinalizacaoDb();
    db.order.status = "RESERVADO";
    db.order.finalizationIdempotencyKey = "finalizacao-original-123456";
    db.order.buyerName = "Ana Maria";
    db.order.buyerEmail = "ana@example.com";
    db.order.buyerPhone = "5511999999999";

    const result = await new EventosPublicSalesService({ db } as any).finalizarPedidoConvidado("ABC123DEF456", { ...entradaFinalizacao(), idempotencyKey: "finalizacao-original-123456" });

    expect(result.acesso).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(db.acceptances).toHaveLength(0);
    expect(db.participants).toHaveLength(0);
    expect(db.tokens).toHaveLength(1);
  });

  it.each(["RESERVADO", "AGUARDANDO_PAGAMENTO"])("rejeita chave diferente após finalização no estado %s", async (status) => {
    const db = pedidoFinalizacaoDb();
    db.order.status = status;
    db.order.finalizationIdempotencyKey = "finalizacao-original-123456";
    db.order.buyerName = "Ana Maria";
    db.order.buyerEmail = "ana@example.com";
    db.order.buyerPhone = "5511999999999";

    await expect(new EventosPublicSalesService({ db } as any).finalizarPedidoConvidado("ABC123DEF456", entradaFinalizacao())).rejects.toMatchObject({ response: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(db.acceptances).toHaveLength(0);
    expect(db.participants).toHaveLength(0);
  });

  it("serializa finalizações concorrentes e rejeita a segunda chave", async () => {
    const db = pedidoFinalizacaoConcorrenteDb();
    const service = new EventosPublicSalesService({ db } as any);

    const results = await Promise.allSettled([
      service.finalizarPedidoConvidado("ABC123DEF456", entradaFinalizacao()),
      service.finalizarPedidoConvidado("ABC123DEF456", { ...entradaFinalizacao(), idempotencyKey: "finalizacao-outra-123456" }),
    ]);

    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.find((item) => item.status === "rejected")).toMatchObject({ reason: { response: { code: "IDEMPOTENCY_CONFLICT" } } });
    expect(db.acceptances).toHaveLength(5);
    expect(db.participants).toHaveLength(1);
  });

  it("consulta devolve rótulo do lugar, nome do tipo, slug, sessão e expiresAt", async () => {
    const db = pedidoConsultaDb();

    const result = await new EventosPublicSalesService({ db } as any).consultarPedido("ABC123DEF456");

    expect(result).toMatchObject({ eventSlug: "festival-escola", sessionId: "session-1", expiresAt: db.order.expiresAt, items: [{ rowLabel: "A", seatNumber: "12", ticketTypeName: "Inteira" }] });
    expect(result).not.toHaveProperty("tickets");
    expect(JSON.stringify(result)).not.toContain("qrPayload");
    expect(JSON.stringify(result)).not.toContain("numero");
  });

  it("ordena itens pelo participantIndex e expõe o índice persistido", async () => {
    const db = pedidoConsultaOrdenadaDb();

    const result = await new EventosPublicSalesService({ db } as any).consultarPedido("ABC123DEF456");

    expect(result.items.map((item) => item.participantIndex)).toEqual([0, 1]);
    expect(result.items.map((item) => item.seatNumber)).toEqual(["10", "11"]);
    expect(db.orderByCalled).toBe(true);
  });

  it("token válido devolve QR, número, lugar, tipo e participante", async () => {
    const db = ingressosPublicosDb({ token: "acesso-valido", status: "CONFIRMADO", event: { locationName: undefined }, location: { name: "Auditório real" } });
    const result = await new EventosPublicSalesService({ db } as any).obterIngressos("ABC123DEF456", "acesso-valido");

    expect(result).toMatchObject({ buyerName: "Ana", event: { title: "Festival", slug: "festival-escola", imageUrl: "https://cdn.test/festival.png", locationName: "Auditório real" }, tickets: [{ numero: "ABCD2345", qrPayload: "evento:ABCD2345", rowLabel: "A", seatNumber: "12", ticketTypeName: "Inteira", participantName: "Participante", status: "EMITIDO" }] });
    expect(db.tokenWhere).toBeDefined();
  });

  it.each([undefined, [], {}])("acesso ausente ou inválido não causa erro 500 (%p)", async (acesso) => {
    const db = ingressosPublicosDb({ token: "acesso-valido", status: "CONFIRMADO" });

    await expect(new EventosPublicSalesService({ db } as any).obterIngressos("ABC123DEF456", acesso as any)).rejects.toMatchObject({ response: { code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" } });
  });

  it.each([
    ["token de outro pedido", "outro-pedido", { orderId: "order-outro" }],
    ["token vencido", "token-vencido", { orderId: "order-1", expiresAt: new Date(Date.now() - 1_000) }],
    ["token vazio", "", null],
  ])("%s não revela nada", async (_descricao, acesso, token) => {
    const db = ingressosPublicosDb({ token: "acesso-valido", tokenRow: token, status: "CONFIRMADO" });

    await expect(new EventosPublicSalesService({ db } as any).obterIngressos("ABC123DEF456", acesso)).rejects.toMatchObject({ response: { code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" } });
  });

  it("pedido aguardando pagamento devolve tickets vazios", async () => {
    const db = ingressosPublicosDb({ token: "acesso-valido", status: "AGUARDANDO_PAGAMENTO" });
    const result = await new EventosPublicSalesService({ db } as any).obterIngressos("ABC123DEF456", "acesso-valido");

    expect(result.tickets).toEqual([]);
  });

  it("meus ingressos por número e e-mail ignora maiúsculas", async () => {
    const db = meusIngressosDb([{ orderNumber: "ABC123DEF456", buyerEmail: "ana@example.com", status: "CONFIRMADO" }]);
    const result = await new EventosPublicSalesService({ db } as any).buscarMeusIngressos({ orderNumber: "ABC123DEF456", email: "ANA@EXAMPLE.COM" });

    expect(result.pedidos).toHaveLength(1);
    expect(result.pedidos[0]).toMatchObject({ orderNumber: "ABC123DEF456", acesso: expect.any(String) });
    expect(db.tokens[0]).toMatchObject({ orderId: "order-1", email: "ana@example.com" });
  });

  it("meus ingressos por e-mail e celular compara só dígitos", async () => {
    const db = meusIngressosDb([{ orderNumber: "XYZ987654321", buyerEmail: "ana@example.com", buyerPhone: "5511999999999", status: "USADO" }]);
    const result = await new EventosPublicSalesService({ db } as any).buscarMeusIngressos({ email: "ana@example.com", phone: "+55 (11) 99999-9999" });

    expect(result.pedidos).toHaveLength(1);
    expect(result.pedidos[0]?.orderNumber).toBe("XYZ987654321");
  });

  it("meus ingressos não encontrado usa a mensagem genérica", async () => {
    const db = meusIngressosDb([]);

    await expect(new EventosPublicSalesService({ db } as any).buscarMeusIngressos({ orderNumber: "ABC123DEF456", email: "nao@example.com" })).rejects.toMatchObject({ response: { code: "ORDER_NOT_FOUND", message: "Não encontramos um pedido com esses dados" } });
  });

  it("meus ingressos não emite acesso para evento encerrado", async () => {
    const db = meusIngressosDb([{ orderNumber: "ABC123DEF456", buyerEmail: "ana@example.com", status: "CONFIRMADO", eventStatus: "ENCERRADO" }]);

    await expect(new EventosPublicSalesService({ db } as any).buscarMeusIngressos({ orderNumber: "ABC123DEF456", email: "ana@example.com" })).rejects.toMatchObject({ response: { code: "ORDER_NOT_FOUND", message: "Não encontramos um pedido com esses dados" } });
    expect(db.tokens).toHaveLength(0);
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

  it("adquire locks de inventário em ordem de assento, preservando a ordem do participante", async () => {
    const banco = criarBancoReserva({ quantidade: 2, precoAdulto: 1250, offers: [] });
    const input = entradaReserva(2, "locks-assentos-123456");
    input.seats.reverse();

    const resultado = await new EventosPublicSalesService({ db: banco } as any).reservarAssentos(input);

    expect(banco.lockSequence).toEqual([uuid(100), uuid(101)]);
    expect(resultado.items.map((item) => item.seatId)).toEqual(input.seats.map((seat) => seat.seatId));
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
      insert: () => ({ values: async () => [] }),
      selectCalls: 0,
    };

    await expect(new EventosPublicSalesService({ db } as any).finalizarPedidoConvidado("ABC123DEF456", {
      buyer: { name: "Ana", email: "ana@example.com", phone: "11999999999" },
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
      pedido: {
        orderNumber: "ABC123DEF456",
        status: "EXPIRADO",
        eventTitle: "Evento",
        totalCents: 1250,
        items: [{ seatId: "seat-1", ticketTypeId: "ticket-1", totalPriceCents: 1250 }],
      },
      acesso: expect.any(String),
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

  it("calcula o desconto sobre tipos mistos e recusa oferta fixa na compra pública", async () => {
    const ofertaPercentual = { id: uuid(91), version: 1, name: "Volume", pricingType: "PERCENTUAL", minQuantity: 10, maxQuantity: null, discountPercent: 15, priceCents: null, active: true };
    const misto = criarBancoReserva({ quantidade: 10, precoAdulto: 4500, precoCrianca: 2250, offers: [ofertaPercentual], tiposMistos: true });
    const resultadoMisto = await new EventosPublicSalesService({ db: misto } as any).reservarAssentos(entradaReserva(10, "misto-6-4-123456", true));
    expect(resultadoMisto).toMatchObject({ subtotalCents: 36000, discountCents: 5400, totalCents: 30600 });
    expect(resultadoMisto.items.reduce((total, item) => total + item.totalPriceCents, 0)).toBe(30600);

    const ofertaFixa = { id: uuid(92), version: 4, name: "Faixa legada", pricingType: "VALOR_FIXO", minQuantity: 10, maxQuantity: null, discountPercent: null, priceCents: 30000, active: true };
    const fixo = criarBancoReserva({ quantidade: 10, precoAdulto: 4500, offers: [ofertaFixa] });
    await expect(new EventosPublicSalesService({ db: fixo } as any).reservarAssentos(entradaReserva(10, "fixo-10-123456"))).rejects.toMatchObject({ response: { code: "OFFER_NOT_SUPPORTED_PUBLIC" } });
  });

  it("não aplica oferta VALOR_FIXO que não aparece no contrato público", async () => {
    const ofertaFixa = { id: uuid(96), version: 1, name: "Faixa fixa", pricingType: "VALOR_FIXO", minQuantity: 1, maxQuantity: null, discountPercent: null, priceCents: 100, active: true };
    const banco = criarBancoReserva({ quantidade: 1, precoAdulto: 4500, offers: [ofertaFixa] });

    await expect(new EventosPublicSalesService({ db: banco } as any).reservarAssentos(entradaReserva(1, "fixo-publico-123456"))).rejects.toMatchObject({ response: { code: "OFFER_NOT_SUPPORTED_PUBLIC" } });
  });

  it("recusa checkout quando todas as reservas perderam a posse dos assentos", async () => {
    const order = { id: "order-sem-posse", orderNumber: "ABC123DEF456", status: "RESERVADO", totalCents: 1250, buyerName: "Ana", buyerEmail: "a@b.com", buyerPhone: "11999999999", expiresAt: new Date(Date.now() + 60_000), eventId: "event-1", sessionId: "session-1" };
    const db = checkoutDb(order, [{ item: { id: "item-1", ticketTypeId: "ticket-adulto", inventorySeatId: "inventory-1", unitPriceCents: 1250, quantity: 1 }, ticket: { name: "Adulto" } }]);
    db.reservations = [{ id: "reservation-1", orderId: order.id, inventorySeatId: "inventory-1", status: "ATIVA", expiresAt: order.expiresAt }];
    db.inventories = [];
    const createEmbeddedCheckoutSession = jest.fn();
    await expect(new EventosPublicSalesService({ db } as any, { createEmbeddedCheckoutSession } as any).iniciarCheckout(order.orderNumber, { returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno", idempotencyKey: "checkout-sem-posse-123456" })).rejects.toMatchObject({ response: { code: "ORDER_NOT_AVAILABLE" } });
    expect(createEmbeddedCheckoutSession).not.toHaveBeenCalled();
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

  it("rejeita a corrida de idempotência quando a reserva encontrada pertence a outra sessão", async () => {
    const existing = { id: "order-outra-sessao", orderNumber: "ABC123DEF456", sessionId: uuid(99), buyerEmail: null, totalCents: 1250, expiresAt: new Date(Date.now() + 60_000) };
    let selectCalls = 0;
    const db: any = {
      transaction: async () => { throw { code: "23505", constraint: "uq_evento_pedidos_idempotency_key" }; },
      select: () => {
        const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => (selectCalls++ === 0 ? [existing] : []) };
        return chain;
      },
    };

    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos(entradaReserva(1, "corrida-sessao-123456"))).rejects.toMatchObject({
      response: { code: "IDEMPOTENCY_CONFLICT" },
    });
  });

  it("reconhece a colisão de idempotência da reserva no formato do Drizzle (erro em cause, constraint_name)", async () => {
    const existing = { id: "order-outra-sessao", orderNumber: "ABC123DEF456", sessionId: uuid(99), buyerEmail: null, totalCents: 1250, expiresAt: new Date(Date.now() + 60_000) };
    let selectCalls = 0;
    const db: any = {
      transaction: async () => { throw erroUnicoDrizzle("uq_evento_pedidos_idempotency_key"); },
      select: () => {
        const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => (selectCalls++ === 0 ? [existing] : []) };
        return chain;
      },
    };

    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos(entradaReserva(1, "corrida-drizzle-123456"))).rejects.toMatchObject({
      response: { code: "IDEMPOTENCY_CONFLICT" },
    });
  });

  it("reconhece a colisão de idempotência da finalização no formato do Drizzle e devolve o próprio pedido", async () => {
    const db = pedidoFinalizacaoDb();
    db.transaction = async () => { throw erroUnicoDrizzle("uq_evento_pedidos_finalization_idempotency_key"); };
    // Depois da colisão, a busca pela chave de finalização encontra o próprio pedido.
    const selectOriginal = db.select;
    let primeiraConsulta = true;
    db.select = () => {
      if (!primeiraConsulta) return selectOriginal();
      primeiraConsulta = false;
      const chain: any = { from: () => chain, where: async () => [db.order] };
      return chain;
    };
    db.selectCalls = 2;

    const result = await new EventosPublicSalesService({ db } as any).finalizarPedidoConvidado("ABC123DEF456", entradaFinalizacao());

    expect(result.acesso).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.pedido).toMatchObject({ orderNumber: "ABC123DEF456" });
  });

  it("não trata outro erro do banco como colisão de idempotência", async () => {
    const erro = erroUnicoDrizzle("fk_qualquer", "23503");
    const db: any = { transaction: async () => { throw erro; }, select: () => { throw new Error("não deveria consultar"); } };

    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos(entradaReserva(1, "erro-fk-123456"))).rejects.toBe(erro);
  });

  it("recusa a corrida quando não consegue comprovar os mesmos assentos", async () => {
    const existing = { id: "order-sem-itens", orderNumber: "ABC123DEF456", buyerEmail: null, totalCents: 1250, expiresAt: new Date(Date.now() + 60_000) };
    let selectCalls = 0;
    const db: any = {
      transaction: async () => { throw { code: "23505", constraint: "uq_evento_pedidos_idempotency_key" }; },
      select: () => {
        const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => (selectCalls++ === 0 ? [existing] : []) };
        return chain;
      },
    };

    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos(entradaReserva(1, "corrida-sem-itens"))).rejects.toMatchObject({ response: { code: "IDEMPOTENCY_CONFLICT" } });
  });

  it("trata a colisão do INSERT interno sem a mesma sessão fora da transação abortada", async () => {
    const banco = criarBancoReservaComColisao("outro@example.com");

    await expect(new EventosPublicSalesService({ db: banco } as any).reservarAssentos(entradaReserva(1, "colisao-interna-outro-123456"))).rejects.toMatchObject({
      response: { code: "IDEMPOTENCY_CONFLICT" },
    });
    expect(banco.colisao.insertAttempts).toBe(1);
  });

  it("recusa a colisão do INSERT interno quando não há prova dos mesmos assentos", async () => {
    const banco = criarBancoReservaComColisao("A@B.COM");

    await expect(new EventosPublicSalesService({ db: banco } as any).reservarAssentos(entradaReserva(1, "colisao-interna-proprio-123456"))).rejects.toMatchObject({ response: { code: "IDEMPOTENCY_CONFLICT" } });
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

function entradaReserva(quantidade: number, idempotencyKey: string, misto = false, semBuyer = false) {
  return {
    sessionId: uuid(1),
    seats: Array.from({ length: quantidade }, (_, index) => ({ seatId: uuid(100 + index), ticketTypeId: uuid(misto && index >= 6 ? 3 : 2), participantIndex: index })),
    ...(semBuyer ? {} : { buyer: { name: "Ana", email: "a@b.com", phone: "11999999999" } }),
    idempotencyKey,
  };
}

function criarBancoReservaComColisao(buyerEmail: string) {
  return criarBancoReserva({ quantidade: 1, precoAdulto: 1250, offers: [], colisao: { buyerEmail } });
}

function criarBancoReserva(config: { quantidade: number; precoAdulto: number; precoCrianca?: number; offers: any[]; tiposMistos?: boolean; repetir?: boolean; colisao?: { buyerEmail: string }; takeover?: boolean; takeoverMultiassento?: boolean; statusInicial?: string }) {
  const event = { id: uuid(10), status: "PUBLICADO" };
  const session = { id: uuid(1), status: "PUBLICADA" };
  const tickets = [
    { id: uuid(2), eventId: event.id, priceCents: config.precoAdulto, maxPerOrder: null, version: 1, active: true },
    { id: uuid(3), eventId: event.id, priceCents: config.precoCrianca ?? config.precoAdulto, maxPerOrder: null, version: 1, active: true },
  ];
  const oldOrder: any = { id: uuid(499), orderNumber: "OLD123456789", eventId: event.id, sessionId: session.id, status: "RESERVADO", expiresAt: new Date(Date.now() - 60_000) };
  const oldReservations: any[] = [];
  const inventories = Array.from({ length: config.quantidade }, (_, index) => ({ id: uuid(200 + index), sessionId: session.id, seatId: uuid(100 + index), status: config.statusInicial ?? (config.takeover && (index === 0 || config.takeoverMultiassento) ? "RESERVADO" : "DISPONIVEL"), reservedByOrderId: config.takeover && (index === 0 || config.takeoverMultiassento) ? oldOrder.id : null, reservationExpiresAt: config.takeover && (index === 0 || config.takeoverMultiassento) ? new Date(Date.now() - 60_000) : null }));
  for (const [index, inventory] of inventories.entries()) oldReservations.push({ id: uuid(498 + index), orderId: oldOrder.id, inventorySeatId: inventory.id, status: "ATIVA", expiresAt: new Date(Date.now() - 60_000) });
  const oldReservation: any = oldReservations[0];
  const order: any = { id: uuid(500), orderNumber: "ABC123DEF456", eventId: event.id, sessionId: session.id, buyerEmail: "a@b.com", expiresAt: new Date(Date.now() + 60_000) };
  const itemRows: any[] = [];
  let selectCalls = 0;
  let ticketReads = 0;
  let inventoryReads = 0;
  let insertCalls = 0;
  let takeoverInventoryUpdates = 0;
  let takeoverReservationUpdates = 0;
  let inTransaction = false;
  let transactionAborted = false;
  let externalCollisionLookupDone = false;
  const collisionOrder: any = { id: uuid(501), orderNumber: "COLISAO123456", eventId: event.id, sessionId: session.id, buyerEmail: config.colisao?.buyerEmail, totalCents: config.precoAdulto, expiresAt: new Date(Date.now() + 60_000) };
  const mutations = { value: 0 };
  const banco: any = {
    order,
    oldOrder,
    oldReservation,
    reservasAntigas: oldReservations,
    inventariosAntigos: inventories,
    pagamentoAntigo: { id: "payment-old", orderId: oldOrder.id, status: "PENDENTE" },
    itemRows,
    mutations,
    lockSequence: [] as string[],
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
        selectCalls += 1;
      let table: any;
      let resolved: any[] | undefined;
      const resolveValue = () => {
        if (resolved) return resolved;
        let value: any[] = [];
        if (config.colisao && !inTransaction && !externalCollisionLookupDone) {
          externalCollisionLookupDone = true;
          value = [collisionOrder];
          } else if (config.repetir && banco.jaCriado && table === eventoPedidos) {
          value = [order];
        } else if (config.repetir && banco.jaCriado && table === eventoItensPedido) {
          value = itemRows.map((item) => ({ item, inventory: inventories.find((inventory) => inventory.id === item.inventorySeatId) }));
          } else if (table === eventos) value = [{ event, session }];
          else if (table === eventoTiposIngresso) value = [tickets[Math.min(ticketReads++, tickets.length - 1)]];
          else if (table === eventoInventarioAssentos) {
            const read = inventoryReads++;
            const inventoryIndex = read < config.quantidade ? read : read - config.quantidade;
            value = [inventories[Math.min(inventoryIndex, inventories.length - 1)]];
          }
          else if (table === eventoOfertas) value = banco.configuracaoAtual;
          else if (table === eventoReservas) value = config.takeover ? oldReservations : [];
          else if (table === eventoItensPedido) value = itemRows.map((item) => ({ item, inventory: inventories.find((inventory) => inventory.id === item.inventorySeatId) }));
          else if (table === eventoPedidos) value = [];
        resolved = value;
        return value;
      };
      const chain: any = {
        from: (selected: any) => { table = selected; return chain; },
        innerJoin: () => chain,
        where: () => {
          const promise: any = Promise.resolve(resolveValue());
          promise.for = () => {
            if (table === eventoInventarioAssentos) {
              const inventory = resolveValue()[0];
              if (inventory?.seatId) banco.lockSequence.push(inventory.seatId);
            }
            return promise;
          };
          return promise;
        },
        orderBy: async () => resolveValue(),
        for: () => chain,
      };
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
        if (payload.ticketTypeId) itemRows.push(payload);
        return Promise.resolve([]);
      } };
    },
    update: (table: any) => { mutations.value += 1; return { set: (payload: any) => { const operation: any = { where: (predicate: any) => { if (config.takeover && table === eventoReservas && payload.status === "LIBERADA") { const target = config.takeoverMultiassento ? oldReservations[takeoverReservationUpdates++] : oldReservation; if (target) Object.assign(target, payload); } if (config.takeover && table === eventoInventarioAssentos && payload.status === "DISPONIVEL") { const target = config.takeoverMultiassento ? inventories[takeoverInventoryUpdates++] : inventories[0]; if (target) Object.assign(target, payload); } if (config.takeover && table === eventoPedidos && payload.status === "EXPIRADO") Object.assign(oldOrder, payload); if (config.takeover && table === eventoPagamentos && payload.status === "EXPIRADO") Object.assign(banco.pagamentoAntigo, payload); return operation; }, returning: async () => [{}] }; operation.then = (resolve: any, reject: any) => operation.returning().then(resolve, reject); return operation; } }; },
  };
  return banco;
}

function corridaIdempotenciaDb(config: { seatId: string }) {
  const order = { id: "order-corrida", orderNumber: "ABC123DEF456", eventId: "event-1", sessionId: uuid(1), buyerName: null, buyerEmail: null, buyerPhone: null, totalCents: 1250, expiresAt: new Date(Date.now() + 60_000) };
  let selects = 0;
  const db: any = {
    transaction: async () => { throw { code: "23505", constraint: "uq_evento_pedidos_idempotency_key" }; },
    select: (table: any) => {
      const value = selects++ === 0 ? [order] : selects === 2 ? [{ inventory: { seatId: config.seatId } }] : [{ item: { ticketTypeId: uuid(2), unitPriceCents: 1250, totalPriceCents: 1250 }, inventory: { seatId: config.seatId } }];
      const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => value };
      return chain;
    },
  };
  return db;
}

function entradaFinalizacao() {
  return {
    buyer: { name: "  Ana Maria  ", email: " ANA@EXAMPLE.COM ", phone: "+55 (11) 99999-9999" },
    participants: [{ participantIndex: 0, fullName: "Participante", type: "CONVIDADO" as const }],
    acceptances: ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"].map((type) => ({ type, version: 1 })),
    idempotencyKey: "finalizacao-nova-123456",
  };
}

function pedidoFinalizacaoDb() {
  const order: any = { id: "order-1", orderNumber: "ABC123DEF456", eventId: "event-1", sessionId: "session-1", status: "INICIADO", totalCents: 1250, subtotalCents: 1250, discountCents: 0, expiresAt: new Date("2026-12-01T12:00:00Z") };
  const event = { id: "event-1", status: "PUBLICADO", title: "Festival", slug: "festival-escola" };
  const session = { id: "session-1", status: "PUBLICADA", startsAt: new Date("2026-12-01T10:00:00Z"), endsAt: new Date("2026-12-07T12:00:00Z") };
  const policies = ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"].map((type) => ({ id: `policy-${type}`, type, version: 1 }));
  const item = { id: "item-1", orderId: order.id, ticketTypeId: "ticket-1", pricingEvidence: { participantIndex: 0 }, unitPriceCents: 1250, totalPriceCents: 1250 };
  const reservation = { id: "reservation-1", orderId: order.id, inventorySeatId: "inventory-1", status: "ATIVA", expiresAt: order.expiresAt };
  const inventory = { id: "inventory-1", reservedByOrderId: order.id, status: "RESERVADO", reservationExpiresAt: order.expiresAt };
  const itemResult = { item, inventory: { seatId: "seat-1" }, seat: { rowLabel: "A", seatNumber: "12" }, ticket: { name: "Inteira" } };
  const db: any = { order, acceptances: [], tokens: [], participants: [], transaction: async (fn: any) => fn(db), selectCalls: 0 };
  db.select = () => {
    const call = db.selectCalls++;
    let table: any;
    const chain: any = {
      from: (selected: any) => { table = selected; return chain; },
      innerJoin: () => chain,
      where: () => {
        const value = table === eventoPedidos
          ? (call === 1 ? [] : [{ order, event, session }])
          : table === eventoPoliticas ? policies
            : table === eventoItensPedido ? (call === 3 ? [item] : [itemResult])
              : table === eventoReservas ? [reservation]
                : table === eventoInventarioAssentos ? [inventory]
                  : [];
        const promise: any = Promise.resolve(value);
        promise.for = () => promise;
        return promise;
      },
      for: () => chain,
    };
    return chain;
  };
  db.insert = (table: any) => {
    const operation: any = { values: (payload: any) => { if (table === eventoAceites) db.acceptances.push(payload); if (table === eventoTokensConsulta) db.tokens.push(payload); if (table === eventoParticipantes) db.participants.push(payload); return operation; }, returning: async () => [{ id: "participant-1" }] };
    return operation;
  };
  db.update = () => ({ set: (payload: any) => { Object.assign(order, payload); return { where: async () => [] }; } });
  return db;
}

function pedidoFinalizacaoConcorrenteDb() {
  const db = pedidoFinalizacaoDb();
  let firstRead = true;
  const originalSelect = db.select;
  db.select = () => {
    const chain: any = originalSelect();
    const originalWhere = chain.where;
    chain.where = (...args: any[]) => {
      const wrapped: any = Promise.resolve(originalWhere(...args)).then(async (value) => {
        if (firstRead) {
          firstRead = false;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return value;
      });
      wrapped.for = () => wrapped;
      return wrapped;
    };
    chain.for = () => chain;
    return chain;
  };
  return db;
}

function checkoutConcorrenteDb(order: any) {
  const rows = [{ item: { id: "item-1", orderId: order.id, ticketTypeId: "ticket-1", unitPriceCents: 1250, totalPriceCents: 1250, quantity: 1 }, ticket: { name: "Adulto" } }];
  const reservations = [{ id: "reservation-1", orderId: order.id, inventorySeatId: "inventory-1", status: "ATIVA", expiresAt: order.expiresAt }];
  const inventories = [{ id: "inventory-1", reservedByOrderId: order.id, status: "RESERVADO", reservationExpiresAt: order.expiresAt }];
  const db: any = { order, payments: [], selectCalls: 0 };
  db.transaction = async (fn: any) => fn(db);
  db.select = () => {
    const chain: any = {
      from: (table: any) => { chain.table = table; return chain; },
      innerJoin: () => chain,
      where: async () => {
        if (chain.table === eventoPedidos) return [{ order, event: { id: order.eventId, status: "PUBLICADO", title: "Evento" }, session: { id: order.sessionId, status: "PUBLICADA" } }];
        if (chain.table === eventoItensPedido) return rows;
        if (chain.table === eventoReservas) return reservations;
        if (chain.table === eventoInventarioAssentos) return inventories;
        if (chain.table === eventoPagamentos) return db.payments;
        return [];
      },
      for: () => chain,
    };
    return chain;
  };
  db.insert = (table: any) => ({ values: (payload: any) => { if (table === eventoPagamentos) db.payments.push({ id: "payment-1", ...payload }); return Promise.resolve([]); } });
  db.update = () => ({ set: (payload: any) => ({ where: async () => { Object.assign(order, payload); return []; } }) });
  return db;
}

function pedidoConsultaDb() {
  const order: any = { id: "order-1", orderNumber: "ABC123DEF456", eventId: "event-1", sessionId: "session-1", status: "RESERVADO", totalCents: 1250, subtotalCents: 1250, discountCents: 0, expiresAt: new Date("2026-12-01T12:00:00Z") };
  const event = { id: "event-1", status: "PUBLICADO", title: "Festival", slug: "festival-escola" };
  const session = { id: "session-1", status: "PUBLICADA", startsAt: new Date("2026-12-01T10:00:00Z"), endsAt: new Date("2026-12-07T12:00:00Z") };
  let call = 0;
  const db: any = { order, select: () => { const value = call++ === 0 ? [{ order, event, session }] : [{ item: { ticketTypeId: "ticket-1", unitPriceCents: 1250, totalPriceCents: 1250 }, inventory: { seatId: "seat-1" }, seat: { rowLabel: "A", seatNumber: "12" }, ticket: { name: "Inteira" } }]; const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => value }; return chain; } };
  return db;
}

function pedidoConsultaOrdenadaDb() {
  const order: any = { id: "order-1", orderNumber: "ABC123DEF456", eventId: "event-1", sessionId: "session-1", status: "RESERVADO", totalCents: 2500, subtotalCents: 2500, discountCents: 0, expiresAt: new Date("2026-12-01T12:00:00Z") };
  const event = { id: "event-1", status: "PUBLICADO", title: "Festival", slug: "festival-escola" };
  const session = { id: "session-1", status: "PUBLICADA", startsAt: new Date("2026-12-01T10:00:00Z"), endsAt: new Date("2026-12-07T12:00:00Z") };
  const rows = [
    { item: { ticketTypeId: "ticket-2", unitPriceCents: 1250, totalPriceCents: 1250, pricingEvidence: { participantIndex: 1 } }, inventory: { seatId: "seat-2" }, seat: { rowLabel: "A", seatNumber: "11" }, ticket: { name: "Inteira" } },
    { item: { ticketTypeId: "ticket-1", unitPriceCents: 1250, totalPriceCents: 1250, pricingEvidence: { participantIndex: 0 } }, inventory: { seatId: "seat-1" }, seat: { rowLabel: "A", seatNumber: "10" }, ticket: { name: "Inteira" } },
  ];
  const db: any = { order, orderByCalled: false, selectCalls: 0 };
  db.select = () => {
    const call = db.selectCalls++;
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => {
        const value: any = call === 0 ? [{ order, event, session }] : rows;
        const promise: any = Promise.resolve(value);
        promise.orderBy = () => { db.orderByCalled = true; return Promise.resolve([...rows].sort((a, b) => a.item.pricingEvidence.participantIndex - b.item.pricingEvidence.participantIndex)); };
        return promise;
      },
      orderBy: () => { db.orderByCalled = true; return Promise.resolve([...rows].sort((a, b) => a.item.pricingEvidence.participantIndex - b.item.pricingEvidence.participantIndex)); },
    };
    return chain;
  };
  return db;
}

function vendaDb(data: any) {
  let selects = 0;
  const order = { id: "order-1", orderNumber: "ABC123DEF456", totalCents: data.ticket?.priceCents ?? 0, expiresAt: new Date(Date.now() + 60_000), buyerEmail: "a@b.com" };
  const rows = [[], data.session ? [{ event: data.event, session: data.session }] : [], data.ticket ? [data.ticket] : [], data.inventory ? [data.inventory] : [], data.inventory ? [data.inventory] : [], [], [{ item: { ticketTypeId: data.ticket?.id, unitPriceCents: data.ticket?.priceCents, totalPriceCents: data.ticket?.priceCents }, inventory: data.inventory }]];
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
    ...(data.inventories ?? []).flatMap((inventory: any) => [[inventory], [inventory]]),
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

function checkoutDb(order: any, rows: any[], payment: any = null) {
  const reservations = rows.map((row: any, index: number) => ({ id: `reservation-${index}`, orderId: order.id, inventorySeatId: row.item?.inventorySeatId ?? `inventory-${index}`, status: "ATIVA", expiresAt: order.expiresAt }));
  const inventories = rows.map((row: any, index: number) => ({ id: row.item?.inventorySeatId ?? `inventory-${index}`, reservedByOrderId: order.id, status: "RESERVADO", reservationExpiresAt: order.expiresAt }));
  const db: any = {
    paymentPayload: null,
    reservations,
    inventories,
    select: () => {
      const chain: any = { table: undefined, from: (table: any) => { chain.table = table; return chain; }, innerJoin: () => chain, where: async () => {
        if (chain.table === eventoPedidos) return [{ order, event: { id: order.eventId, status: "PUBLICADO", title: "Evento" }, session: { id: order.sessionId, status: "PUBLICADA" } }];
        if (chain.table === eventoItensPedido) return rows;
        if (chain.table === eventoReservas) return db.reservations;
        if (chain.table === eventoInventarioAssentos) return db.inventories;
        if (chain.table === eventoPagamentos) return payment ? [payment] : [];
        return [];
      }, for: () => chain };
      return chain;
    },
    insert: (_table: any) => ({ values: (payload: any) => { db.paymentPayload = payload; return Promise.resolve([]); } }),
    update: () => ({ set: (payload: any) => ({ where: async () => { if (payload.expectedAmountCents !== undefined) db.paymentPayload = payload; return []; } }) }),
  };
  return db;
}

function ingressosPublicosDb(config: { token: string; tokenRow?: any; status: string; event?: any; location?: any }) {
  const order: any = { id: "order-1", orderNumber: "ABC123DEF456", eventId: "event-1", sessionId: "session-1", buyerName: "Ana", buyerEmail: "ana@example.com", status: config.status, totalCents: 1250, subtotalCents: 1250, discountCents: 0, expiresAt: new Date("2026-12-01T12:00:00Z") };
  const event = { id: "event-1", status: "PUBLICADO", title: "Festival", slug: "festival-escola", imageUrl: "https://cdn.test/festival.png", ...config.event };
  const session = { id: "session-1", status: "PUBLICADA", locationId: "location-1", startsAt: new Date("2026-12-01T10:00:00Z"), endsAt: new Date("2026-12-07T12:00:00Z") };
  const location = config.location ?? { id: "location-1", name: "Auditório" };
  const tokenRow = config.tokenRow === undefined ? { orderId: order.id, tokenHash: hashTokenAcesso(config.token), expiresAt: new Date(Date.now() + 60_000) } : config.tokenRow;
  const tokenTable = (eventoTokensConsulta as any) ?? (schema as any)?.eventoTokensConsulta ?? { __eventoTokensConsulta: true };
  const db: any = { order, tokens: [], selectCalls: 0 };
  db.select = () => {
    const call = db.selectCalls++;
    const chain: any = {
      from: (table: any) => { chain.table = table; return chain; },
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: async (condition: any) => {
        if (call === 0) return [{ order, event, session, location }];
        if (call === 1) { db.tokenWhere = condition; return tokenRow ? [tokenRow] : []; }
        if (call === 2) return [{ item: { ticketTypeId: "ticket-1", unitPriceCents: 1250, totalPriceCents: 1250 }, inventory: { seatId: "seat-1" }, seat: { rowLabel: "A", seatNumber: "12" }, ticket: { name: "Inteira" } }];
        if (call === 3) return [{ ticket: { numero: "ABCD2345", qrPayload: "evento:ABCD2345", status: "EMITIDO" }, item: { ticketTypeId: "ticket-1", inventorySeatId: "inventory-1" }, seat: { rowLabel: "A", seatNumber: "12" }, ticketType: { name: "Inteira" }, participant: { fullName: "Participante" } }];
        if (chain.table === tokenTable || chain.table?.__eventoTokensConsulta) db.tokenWhere = condition;
        if (chain.table === tokenTable || chain.table?.__eventoTokensConsulta) return tokenRow ? [tokenRow] : [];
        if (chain.table === eventoPedidos) return [{ order, event, session, location }];
        if (chain.table === eventoIngressos) return [{ ticket: { numero: "ABCD2345", qrPayload: "evento:ABCD2345", status: "EMITIDO" }, item: { ticketTypeId: "ticket-1", inventorySeatId: "inventory-1" }, seat: { rowLabel: "A", seatNumber: "12" }, ticketType: { name: "Inteira" }, participant: { fullName: "Participante" } }];
        if (chain.table === eventoItensPedido) return [{ item: { ticketTypeId: "ticket-1", unitPriceCents: 1250, totalPriceCents: 1250 }, inventory: { seatId: "seat-1" }, seat: { rowLabel: "A", seatNumber: "12" }, ticket: { name: "Inteira" } }];
        return [];
      },
    };
    return chain;
  };
  db.insert = (table: any) => ({ values: (payload: any) => { if (table === tokenTable || table === eventoTokensConsulta || table?.__eventoTokensConsulta) db.tokens.push(payload); return Promise.resolve([]); } });
  return db;
}

function meusIngressosDb(orders: Array<{ orderNumber: string; buyerEmail: string; buyerPhone?: string; status: string; eventStatus?: string; sessionStatus?: string }>) {
  const rows = orders.map((input, index) => ({ order: { id: `order-${index + 1}`, eventId: `event-${index + 1}`, sessionId: `session-${index + 1}`, orderNumber: input.orderNumber, buyerEmail: input.buyerEmail, buyerPhone: input.buyerPhone ?? "5511888888888", status: input.status }, event: { title: "Festival", status: input.eventStatus ?? "PUBLICADO" }, session: { startsAt: new Date("2026-12-01T10:00:00Z"), endsAt: new Date("2026-12-07T12:00:00Z"), status: input.sessionStatus ?? "PUBLICADA" } }));
  const db: any = { tokens: [] };
  const tokenTable = (eventoTokensConsulta as any) ?? (schema as any)?.eventoTokensConsulta ?? { __eventoTokensConsulta: true };
  db.select = () => {
    const chain: any = { from: () => chain, innerJoin: () => chain, where: async () => rows };
    return chain;
  };
  db.insert = (table: any) => ({ values: (payload: any) => { if (table === tokenTable || table === eventoTokensConsulta || table?.__eventoTokensConsulta) db.tokens.push(payload); return Promise.resolve([]); } });
  return db;
}

function liberarPedidoDb(config: { order: any; payment?: any; inventories?: any[]; reservations?: any[]; onTransactionOrderRead?: () => void }) {
  const db: any = {
    order: config.order,
    payment: config.payment ?? null,
    inventory: config.inventories ?? [],
    reservations: config.reservations ?? [],
    mutations: 0,
    lockedReads: 0,
    transaction: async (fn: any) => fn(db),
  };
  let orderReads = 0;
  db.select = () => {
    let table: unknown;
    let result: any[] = [];
    const chain: any = {
      from: (selected: unknown) => { table = selected; return chain; },
      innerJoin: () => chain,
      where: () => {
        if (table === eventoPedidos) {
          orderReads += 1;
          const order = config.onTransactionOrderRead && orderReads === 2 ? { ...db.order } : db.order;
          result = [{ order, event: { status: "PUBLICADO" }, session: { status: "PUBLICADA" } }];
          if (config.onTransactionOrderRead && orderReads === 2) config.onTransactionOrderRead();
        } else if (table === eventoPagamentos) result = db.payment ? [db.payment] : [];
        else if (table === eventoInventarioAssentos) result = db.inventory;
        else if (table === eventoReservas) result = db.reservations;
        else result = [];
        return chain;
      },
      for: () => { db.lockedReads += 1; return chain; },
      then: (resolve: (value: any[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  db.update = (table: unknown) => {
    let payload: any;
    const chain: any = {
      set: (values: any) => { payload = values; return chain; },
      where: async () => {
        let affected = 0;
        if (table === eventoInventarioAssentos) {
          affected = db.inventory.filter((row: any) => row.status === "RESERVADO").length;
          db.inventory.forEach((row: any) => { if (row.status === "RESERVADO") Object.assign(row, payload); });
        }
        if (table === eventoReservas) {
          affected = db.reservations.filter((row: any) => row.status === "ATIVA").length;
          db.reservations.forEach((row: any) => { if (row.status === "ATIVA") Object.assign(row, payload); });
        }
        if (table === eventoPagamentos && db.payment?.status === "PENDENTE") { affected = 1; Object.assign(db.payment, payload); }
        if (table === eventoPedidos && ["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"].includes(db.order.status)) { affected = 1; Object.assign(db.order, payload); }
        db.mutations += affected;
        return Object.assign([], { count: affected });
      },
    };
    return chain;
  };
  return db;
}

/** Reproduz o erro como ele chega do Drizzle 0.45 com postgres-js: o original fica em `cause`. */
function erroUnicoDrizzle(constraint: string, code = "23505") {
  const original = Object.assign(new Error("duplicate key value violates unique constraint"), { code, constraint_name: constraint });
  return Object.assign(new Error("Failed query: insert into ..."), { query: "insert into ...", params: [], cause: original });
}
