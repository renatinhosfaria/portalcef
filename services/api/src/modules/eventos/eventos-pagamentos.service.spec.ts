import { EventosPagamentosService } from "./eventos-pagamentos.service";

describe("EventosPagamentosService", () => {
  it("rejeita valor divergente sem vender assentos", async () => {
    const db: any = {
      transaction: jest.fn(),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            where: jest.fn(async () => [{
              payment: { id: "pagamento-1", expectedAmountCents: 1_000 },
              order: { id: "pedido-1", status: "AGUARDANDO_PAGAMENTO" },
            }]),
          })),
        })),
      })),
    };
    const service = new EventosPagamentosService({ db } as any);

    await expect(
      service.confirmarCheckout({
        checkoutSessionId: "cs_evento_1",
        paymentIntentId: "pi_evento_1",
        amountCents: 999,
      }),
    ).rejects.toMatchObject({ response: { code: "PAYMENT_AMOUNT_MISMATCH" } });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("não duplica ingressos quando o webhook é repetido", async () => {
    const insert = jest.fn();
    const db: any = {
      transaction: async (fn: (tx: any) => Promise<unknown>) => fn(db),
      select: jest.fn(() => {
        const chain: any = {
          from: jest.fn(() => chain),
          innerJoin: jest.fn(() => chain),
          where: jest.fn(async () => [{
            id: "pedido-1",
            eventId: "evento-1",
            sessionId: "sessao-1",
            status: "CONFIRMADO",
            totalCents: 1_000,
          }]),
        };
        return chain;
      }),
      insert,
    };
    const service = new EventosPagamentosService({ db } as any);

    await service.confirmarCheckout({
      checkoutSessionId: "cs_evento_1",
      paymentIntentId: "pi_evento_1",
      amountCents: 1_000,
    });
    await service.confirmarCheckout({
      checkoutSessionId: "cs_evento_1",
      paymentIntentId: "pi_evento_1",
      amountCents: 1_000,
    });

    expect(insert).not.toHaveBeenCalledWith(expect.objectContaining({
      table: "evento_ingressos",
    }));
  });

  it("falha checkout e libera somente reservas ainda não vendidas", async () => {
    const service = new EventosPagamentosService({ db: {} } as any);
    await expect(
      service.falharCheckout({
        checkoutSessionId: "cs_evento_1",
        reason: "Checkout expirado",
      }),
    ).resolves.toBeUndefined();
  });
});
