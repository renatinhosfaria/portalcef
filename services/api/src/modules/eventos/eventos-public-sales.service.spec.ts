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
});
