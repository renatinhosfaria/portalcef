import { EventosPublicController } from "./eventos-public.controller";
import { IP_REAL_DO_PROXY } from "../../common/guards/throttler-ip-real.guard";

describe("EventosPublicController", () => {
  it("tem metadata para usar o IP real do proxy nas rotas públicas", () => {
    expect(Reflect.getMetadata(IP_REAL_DO_PROXY, EventosPublicController)).toBe(true);
  });

  it("expõe as rotas públicas de políticas e vendas", () => {
    const proto = EventosPublicController.prototype as any;
    expect(typeof proto.sessions).toBe("function");
    expect(typeof proto.politicas).toBe("function");
    expect(typeof proto.reservar).toBe("function");
    expect(typeof proto.finalizar).toBe("function");
    expect(typeof proto.checkout).toBe("function");
    expect(typeof proto.consultarPedido).toBe("function");
    expect(typeof proto.obterIngressos).toBe("function");
    expect(typeof proto.buscarMeusIngressos).toBe("function");
    expect(typeof proto.liberar).toBe("function");
  });

  it("protege ingressos por acesso e aplica throttle de 60 por minuto", async () => {
    const sales = { obterIngressos: jest.fn().mockResolvedValue({ tickets: [] }) };
    const controller = new EventosPublicController({} as any, sales as any);

    await expect(controller.obterIngressos("ABC123DEF456", "token-seguro")).resolves.toEqual({ tickets: [] });
    expect(sales.obterIngressos).toHaveBeenCalledWith("ABC123DEF456", "token-seguro");
    expect(Reflect.getMetadata("THROTTLER:LIMITstrict", EventosPublicController.prototype.obterIngressos)).toBe(60);
    expect(Reflect.getMetadata("THROTTLER:TTLstrict", EventosPublicController.prototype.obterIngressos)).toBe(60000);
  });

  it("busca meus ingressos e aplica throttle de 10 por minuto", async () => {
    const sales = { buscarMeusIngressos: jest.fn().mockResolvedValue({ pedidos: [] }) };
    const controller = new EventosPublicController({} as any, sales as any);
    const input = { email: "ana@example.com", phone: "11999999999" };

    await expect(controller.buscarMeusIngressos(input)).resolves.toEqual({ pedidos: [] });
    expect(sales.buscarMeusIngressos).toHaveBeenCalledWith(input);
    expect(Reflect.getMetadata("THROTTLER:LIMITstrict", EventosPublicController.prototype.buscarMeusIngressos)).toBe(10);
    expect(Reflect.getMetadata("THROTTLER:TTLstrict", EventosPublicController.prototype.buscarMeusIngressos)).toBe(60000);
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
