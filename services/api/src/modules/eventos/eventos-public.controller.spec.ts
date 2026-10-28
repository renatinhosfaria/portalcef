import { EventosPublicController } from "./eventos-public.controller";

describe("EventosPublicController", () => {
  it("expõe as rotas públicas de políticas e vendas", () => {
    const proto = EventosPublicController.prototype as any;
    expect(typeof proto.politicas).toBe("function");
    expect(typeof proto.reservar).toBe("function");
    expect(typeof proto.finalizar).toBe("function");
    expect(typeof proto.checkout).toBe("function");
    expect(typeof proto.consultarPedido).toBe("function");
  });
});
