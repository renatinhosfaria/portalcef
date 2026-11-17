import Stripe from "stripe";
import { PaymentsService } from "./payments.service";

describe("PaymentsService.encerrarCheckoutSessionSeAberta", () => {
  function criarServico() {
    const service = new PaymentsService({ get: () => "sk_test_x" } as any);
    const retrieve = jest.fn();
    const expire = jest.fn();
    (service as any).stripe = { checkout: { sessions: { retrieve, expire } } };
    return { service, retrieve, expire };
  }

  it("expira uma sessão aberta", async () => {
    const { service, retrieve, expire } = criarServico();
    retrieve.mockResolvedValue({ status: "open" });

    await expect(service.encerrarCheckoutSessionSeAberta("cs_aberta")).resolves.toBe("expirada");
    expect(expire).toHaveBeenCalledWith("cs_aberta");
  });

  it("devolve concluida sem tentar expirar sessão paga", async () => {
    const { service, retrieve, expire } = criarServico();
    retrieve.mockResolvedValue({ status: "complete" });

    await expect(service.encerrarCheckoutSessionSeAberta("cs_paga")).resolves.toBe("concluida");
    expect(expire).not.toHaveBeenCalled();
  });

  it("devolve encerrada para sessão já expirada", async () => {
    const { service, retrieve, expire } = criarServico();
    retrieve.mockResolvedValue({ status: "expired" });

    await expect(service.encerrarCheckoutSessionSeAberta("cs_expirada")).resolves.toBe("encerrada");
    expect(expire).not.toHaveBeenCalled();
  });

  it("propaga erros do Stripe", async () => {
    const { service } = criarServico();
    const error = new Error("Stripe indisponível");
    (service as any).stripe.checkout.sessions.retrieve.mockRejectedValue(error);

    await expect(service.encerrarCheckoutSessionSeAberta("cs_erro")).rejects.toBe(error);
  });
});

describe("PaymentsService.obterClientSecretSeAberta", () => {
  it("devolve o segredo só de sessão aberta", async () => {
    const service = new PaymentsService({ get: () => "sk_test_x" } as any);
    const retrieve = jest.fn();
    (service as any).stripe = { checkout: { sessions: { retrieve } } };

    retrieve.mockResolvedValueOnce({ status: "open", client_secret: "cs_secret_aberta" });
    await expect(service.obterClientSecretSeAberta("cs_aberta")).resolves.toBe("cs_secret_aberta");

    retrieve.mockResolvedValueOnce({ status: "complete", client_secret: "cs_secret_paga" });
    await expect(service.obterClientSecretSeAberta("cs_paga")).resolves.toBeNull();
  });
});

describe("PaymentsService checkout sessions", () => {
  const inputBase = {
    orderId: "order-123",
    orderNumber: "PED-123",
    totalAmount: 3250,
    customerName: "Maria Silva",
    customerPhone: "11999999999",
    customerEmail: "maria@example.com",
    expiresAt: new Date("2030-01-02T03:04:05.000Z"),
    items: [
      { name: "Ingresso família", unitAmount: 3250, quantity: 1 },
    ],
  };

  function criarServicoCheckout() {
    const service = new PaymentsService({
      get: (key: string) =>
        key === "LOJA_PUBLIC_URL" ? "https://loja.portalcef.com.br" : "sk_test_x",
    } as any);
    const create = jest.fn();
    (service as any).stripe = { checkout: { sessions: { create } } };
    return { service, create };
  }

  it("checkout hospedado envia exatamente os mesmos parâmetros de antes", async () => {
    const { service, create } = criarServicoCheckout();
    create.mockResolvedValue({
      id: "cs_hospedado",
      url: "https://checkout.stripe.com/cs_hospedado",
      payment_intent: "pi_hospedado",
    });

    await expect(
      service.createCheckoutSession({
        ...inputBase,
        successUrl: "https://eventos.portalcef.com.br/sucesso",
        cancelUrl: "https://eventos.portalcef.com.br/cancelado",
        idempotencyKey: "checkout-123",
      }),
    ).resolves.toEqual({
      checkoutSessionId: "cs_hospedado",
      checkoutUrl: "https://checkout.stripe.com/cs_hospedado",
      paymentIntentId: "pi_hospedado",
    });

    expect(create).toHaveBeenCalledWith(
      {
        mode: "payment",
        payment_method_types: ["card", "pix"],
        client_reference_id: "PED-123",
        customer_email: "maria@example.com",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "brl",
              unit_amount: 3250,
              product_data: { name: "Ingresso família" },
            },
          },
        ],
        metadata: {
          orderId: "order-123",
          orderNumber: "PED-123",
          customerName: "Maria Silva",
          customerPhone: "11999999999",
        },
        payment_intent_data: {
          metadata: {
            orderId: "order-123",
            orderNumber: "PED-123",
            customerName: "Maria Silva",
            customerPhone: "11999999999",
          },
        },
        payment_method_options: {
          pix: { expires_after_seconds: 30 * 60 },
        },
        success_url: "https://eventos.portalcef.com.br/sucesso",
        cancel_url: "https://eventos.portalcef.com.br/cancelado",
        expires_at: Math.ceil(inputBase.expiresAt.getTime() / 1000),
      },
      { idempotencyKey: "checkout-123" },
    );
  });

  it("identifica rejeição explícita de expires_at sem tratá-la como timeout ambíguo", async () => {
    const { service, create } = criarServicoCheckout();
    create.mockRejectedValue(new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", message: "expires_at must be at least 30 minutes in the future", param: "expires_at" }));
    await expect(service.createEmbeddedCheckoutSession({ ...inputBase, eventOrderId: "pedido-evento", returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno" })).rejects.toMatchObject({ response: { code: "CHECKOUT_EXPIRATION_INVALID" } });
  });

  it("identifica a geração do checkout na metadata da sessão e do PaymentIntent", async () => {
    const { service, create } = criarServicoCheckout();
    create.mockResolvedValue({ id: "cs_evento", client_secret: "segredo_teste" });
    const entrada = { ...inputBase, eventOrderId: "pedido-evento", eventCheckoutKey: "geracao-checkout", returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno" };
    await service.createEmbeddedCheckoutSession(entrada);
    expect(create.mock.calls[0][0]).toMatchObject({ metadata: { eventCheckoutKey: "geracao-checkout" }, payment_intent_data: { metadata: { eventCheckoutKey: "geracao-checkout" } } });
  });

  it("mantém o corpo idempotente dos eventos mesmo quando uma repetição ocorre minutos depois", async () => {
    const { service, create } = criarServicoCheckout();
    create.mockResolvedValue({ id: "cs_evento", client_secret: "segredo_teste" });
    const relogio = jest.spyOn(Date, "now");
    try {
      const agora = new Date("2029-01-01T12:00:00Z").getTime();
      relogio.mockReturnValue(agora);
      const entrada = { ...inputBase, eventOrderId: "pedido-evento", expiresAt: new Date(agora + 35 * 60000), returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno", idempotencyKey: "chave-persistida" };
      await service.createEmbeddedCheckoutSession(entrada);
      relogio.mockReturnValue(agora + 10 * 60000);
      await service.createEmbeddedCheckoutSession(entrada);
      expect(create.mock.calls[1]).toEqual(create.mock.calls[0]);
    } finally { relogio.mockRestore(); }
  });

  it("checkout embutido envia ui_mode e return_url, sem success/cancel, e devolve clientSecret", async () => {
    const { service, create } = criarServicoCheckout();
    create.mockResolvedValue({
      id: "cs_embutido",
      client_secret: "cs_secret_embutido",
      payment_intent: { id: "pi_embutido" },
    });

    await expect(
      service.createEmbeddedCheckoutSession({
        ...inputBase,
        returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno",
        idempotencyKey: "checkout-embedded-123",
      }),
    ).resolves.toEqual({
      checkoutSessionId: "cs_embutido",
      clientSecret: "cs_secret_embutido",
      paymentIntentId: "pi_embutido",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        ui_mode: "embedded",
        return_url: "https://eventos.portalcef.com.br/pagamento/retorno",
      }),
      { idempotencyKey: "checkout-embedded-123" },
    );
    expect(create.mock.calls[0][0]).not.toHaveProperty("success_url");
    expect(create.mock.calls[0][0]).not.toHaveProperty("cancel_url");
  });

  it("checkout embutido falha sem client_secret", async () => {
    const { service, create } = criarServicoCheckout();
    create.mockResolvedValue({ id: "cs_sem_secret", client_secret: null });

    await expect(
      service.createEmbeddedCheckoutSession({
        ...inputBase,
        returnUrl: "https://eventos.portalcef.com.br/pagamento/retorno",
      }),
    ).rejects.toMatchObject({
      response: {
        code: "CHECKOUT_CLIENT_SECRET_MISSING",
      },
    });
  });
});
