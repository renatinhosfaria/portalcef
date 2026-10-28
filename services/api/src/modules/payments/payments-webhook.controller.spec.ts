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
    });
    expect(loja.confirmStripePayment).not.toHaveBeenCalled();
  });
});
