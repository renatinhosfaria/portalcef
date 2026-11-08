import { describe, expect, it } from "vitest";

import { finalizarPedidoSchema, meusIngressosSchema, pagamentoEmbutidoSchema, reservaPublicaSchema } from "./eventos";

describe("schemas públicos de eventos", () => {
  it("aceita consulta de ingressos por pedido e e-mail", () => {
    expect(meusIngressosSchema.safeParse({ orderNumber: "PED123", email: "cliente@example.com" }).success).toBe(true);
  });

  it("aceita consulta de ingressos por e-mail e telefone", () => {
    expect(meusIngressosSchema.safeParse({ email: "cliente@example.com", phone: "11999999999" }).success).toBe(true);
  });

  it("recusa consulta de ingressos sem identificador suficiente", () => {
    expect(meusIngressosSchema.safeParse({ orderNumber: "PED123" }).success).toBe(false);
  });

  it("recusa pagamento embutido com URL HTTP", () => {
    expect(pagamentoEmbutidoSchema.safeParse({ returnUrl: "http://portalcef.com.br/pagamento", idempotencyKey: "chave-1234" }).success).toBe(false);
  });

  it("recusa campos extras no pagamento embutido", () => {
    expect(pagamentoEmbutidoSchema.safeParse({ returnUrl: "https://portalcef.com.br/pagamento", idempotencyKey: "chave-1234", extra: true }).success).toBe(false);
  });

  it("aceita reserva sem comprador", () => {
    expect(reservaPublicaSchema.safeParse({
      sessionId: "00000000-0000-4000-8000-000000000001",
      seats: [{ seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 }],
      idempotencyKey: "reserva-123456",
    }).success).toBe(true);
  });

  it("recusa finalização sem comprador", () => {
    expect(finalizarPedidoSchema.safeParse({
      participants: [{ participantIndex: 0, fullName: "Ana", type: "CONVIDADO" }],
      acceptances: ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"].map((type) => ({ type, version: 1 })),
      idempotencyKey: "final-123456",
    }).success).toBe(false);
  });
});
