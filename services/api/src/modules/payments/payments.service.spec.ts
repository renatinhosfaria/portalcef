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
