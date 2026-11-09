import { PaymentsWebhookController } from "./payments-webhook.controller";

describe("PaymentsWebhookController - Eventos", () => {
  it("encaminha checkout de Evento pela metadata sem tocar no fluxo da loja", async () => {
    const eventosPagamentos = {
      confirmarCheckout: jest.fn().mockResolvedValue(undefined),
    };
    const loja = { confirmStripePayment: jest.fn() };
    const controller = new PaymentsWebhookController(
      { get: jest.fn().mockReturnValue("whsec_test") } as any,
      { getStripeClient: jest.fn() } as any,
      loja as any,
      eventosPagamentos as any,
    );

    await (controller as any).handleCheckoutSessionCompleted({
      id: "cs_evento_1",
      metadata: { eventOrderId: "pedido-evento-1", orderNumber: "EVT123456789" },
      payment_status: "paid",
      amount_total: 1_000,
      payment_intent: "pi_evento_1",
    });

    expect(eventosPagamentos.confirmarCheckout).toHaveBeenCalledWith({
      checkoutSessionId: "cs_evento_1",
      paymentIntentId: "pi_evento_1",
      amountCents: 1_000,
      eventOrderId: "pedido-evento-1",
    });
    expect(loja.confirmStripePayment).not.toHaveBeenCalled();
  });

  it("encaminha PaymentIntent sem paymentIntent persistido usando eventOrderId", async () => {
    const eventosPagamentos = { confirmarCheckout: jest.fn().mockResolvedValue(undefined) };
    const controller = new PaymentsWebhookController(
      { get: jest.fn().mockReturnValue("whsec_test") } as any,
      { getStripeClient: jest.fn() } as any,
      { confirmStripePayment: jest.fn() } as any,
      eventosPagamentos as any,
    );

    await (controller as any).handlePaymentSucceeded({ id: "pi_novo", amount: 1_000, metadata: { eventOrderId: "pedido-evento-1" }, payment_method_types: ["card"] });

    expect(eventosPagamentos.confirmarCheckout).toHaveBeenCalledWith(expect.objectContaining({ paymentIntentId: "pi_novo", eventOrderId: "pedido-evento-1" }));
  });

  it("mantém a reserva em falha transitória e só encerra no cancelamento terminal", async () => {
    const eventosPagamentos = { falharCheckout: jest.fn().mockResolvedValue(undefined) };
    const controller = new PaymentsWebhookController(
      { get: jest.fn().mockReturnValue("whsec_test") } as any,
      { getStripeClient: jest.fn() } as any,
      { failStripePayment: jest.fn() } as any,
      eventosPagamentos as any,
    );
    const paymentIntent = { id: "pi-falha", metadata: { eventOrderId: "pedido-evento-1" }, last_payment_error: { message: "recusado" } };
    await (controller as any).handlePaymentFailed(paymentIntent);
    expect(eventosPagamentos.falharCheckout).not.toHaveBeenCalled();
    await (controller as any).handlePaymentCanceled(paymentIntent);
    expect(eventosPagamentos.falharCheckout).toHaveBeenCalledTimes(1);
    expect(eventosPagamentos.falharCheckout).toHaveBeenCalledWith(expect.objectContaining({ paymentIntentId: "pi-falha", eventOrderId: "pedido-evento-1" }));
  });

  it("permite retry do mesmo pedido após payment_intent.payment_failed", async () => {
    const eventosPagamentos = {
      falharCheckout: jest.fn(),
      confirmarCheckout: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new PaymentsWebhookController(
      { get: jest.fn().mockReturnValue("whsec_test") } as any,
      { getStripeClient: jest.fn() } as any,
      { failStripePayment: jest.fn() } as any,
      eventosPagamentos as any,
    );
    const paymentIntent = { id: "pi-retry", amount: 1_000, metadata: { eventOrderId: "pedido-evento-1" }, last_payment_error: { message: "recusado" }, payment_method_types: ["card"] };

    await (controller as any).handlePaymentFailed(paymentIntent);
    await (controller as any).handlePaymentSucceeded({ ...paymentIntent, id: "pi-retry-2" });

    expect(eventosPagamentos.falharCheckout).not.toHaveBeenCalled();
    expect(eventosPagamentos.confirmarCheckout).toHaveBeenCalledWith(expect.objectContaining({ eventOrderId: "pedido-evento-1", amountCents: 1_000 }));
  });

  it("falha explicitamente se o provider obrigatório estiver ausente", async () => {
    const controller = new PaymentsWebhookController(
      { get: jest.fn().mockReturnValue("whsec_test") } as any,
      { getStripeClient: jest.fn() } as any,
      { confirmStripePayment: jest.fn() } as any,
    );

    await expect((controller as any).handleCheckoutSessionCompleted({ id: "cs_evento_1", metadata: { eventOrderId: "pedido-evento-1" }, payment_status: "paid", amount_total: 1_000, payment_intent: "pi_evento_1" })).rejects.toMatchObject({ response: { code: "EVENTOS_PAYMENTS_PROVIDER_UNAVAILABLE" } });
  });
});
