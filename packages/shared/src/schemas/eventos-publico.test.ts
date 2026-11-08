import { describe, expect, it } from "vitest";

import { meusIngressosSchema, pagamentoEmbutidoSchema } from "./eventos";

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
});
