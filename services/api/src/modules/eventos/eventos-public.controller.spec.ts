import { EventosPublicController } from "./eventos-public.controller";

describe("EventosPublicController", () => {
  it("expõe as rotas públicas de políticas e vendas", () => {
    const proto = EventosPublicController.prototype as any;
    expect(typeof proto.sessions).toBe("function");
    expect(typeof proto.politicas).toBe("function");
    expect(typeof proto.reservar).toBe("function");
    expect(typeof proto.finalizar).toBe("function");
    expect(typeof proto.checkout).toBe("function");
    expect(typeof proto.consultarPedido).toBe("function");
    expect(typeof proto.liberar).toBe("function");
  });

  it("expõe a rota de liberação com throttle estrito de 20 por minuto", async () => {
    const sales = { liberarPedido: jest.fn().mockResolvedValue({ liberado: true }) };
    const controller = new EventosPublicController({} as any, sales as any);
    await expect(controller.liberar("ABC123DEF456")).resolves.toEqual({ liberado: true });
    expect(sales.liberarPedido).toHaveBeenCalledWith("ABC123DEF456");
    expect(Reflect.getMetadata("THROTTLER:LIMITstrict", EventosPublicController.prototype.liberar)).toBe(20);
    expect(Reflect.getMetadata("THROTTLER:TTLstrict", EventosPublicController.prototype.liberar)).toBe(60000);
  });

  it("devolve a oferta percentual ativa no contrato público da sessão", async () => {
    const sessions = [{ id: "s-ballet", offers: [{ id: "oferta-volume", version: 1, name: "Ballet em grupo", minQuantity: 10, maxQuantity: null, discountPercent: 15 }] }];
    const service = { listarSessoesPublicas: jest.fn().mockResolvedValue(sessions) };
    const controller = new EventosPublicController(service as any, {} as any);

    await expect(controller.sessions("ballet")).resolves.toEqual(sessions);
    expect(service.listarSessoesPublicas).toHaveBeenCalledWith("ballet");
  });
});
