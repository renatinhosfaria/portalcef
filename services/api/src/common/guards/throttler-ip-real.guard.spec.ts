import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";

import {
  IP_REAL_DO_PROXY,
  ThrottlerIpRealGuard,
  UsarIpRealDoProxy,
  ipRealDaRequisicao,
} from "./throttler-ip-real.guard";

describe("ipRealDaRequisicao", () => {
  it("usa x-real-ip vindo do nginx quando req.ip e privado", () => {
    expect(
      ipRealDaRequisicao({
        ip: "172.18.0.5",
        headers: { "x-real-ip": "  189.10.20.30  " },
      }),
    ).toBe("189.10.20.30");
  });

  it("ignora o cabecalho quando a conexao vem de IP publico", () => {
    expect(
      ipRealDaRequisicao({
        ip: "189.10.20.30",
        headers: { "x-real-ip": "203.0.113.10" },
      }),
    ).toBe("189.10.20.30");
  });

  it("ignora x-real-ip invalido", () => {
    expect(
      ipRealDaRequisicao({
        ip: "192.168.1.10",
        headers: { "x-real-ip": "nao-e-ip" },
      }),
    ).toBe("192.168.1.10");
  });
});

describe("ThrottlerIpRealGuard", () => {
  const criarContexto = (handler: object, classe: object): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => classe,
    }) as unknown as ExecutionContext;

  it("troca o tracker somente quando a metadata esta no handler ou na classe", async () => {
    const handler = jest.fn();
    class ControllerComMetadata {}
    UsarIpRealDoProxy()(ControllerComMetadata);
    const contexto = criarContexto(handler, ControllerComMetadata);
    const trackerOriginal = jest.fn().mockReturnValue("tracker-original");
    const props = {
      context: contexto,
      limit: 1,
      ttl: 60,
      blockDuration: 60,
      throttler: { name: "strict", limit: 1, ttl: 60 },
      getTracker: trackerOriginal,
      generateKey: jest.fn(),
    };
    const spy = jest.spyOn(ThrottlerGuard.prototype as any, "handleRequest").mockImplementation(async (recebidos: any) => {
      expect(recebidos.getTracker).toBe(ipRealDaRequisicao);
      return recebidos.getTracker({ ip: "172.18.0.5", headers: { "x-real-ip": "198.51.100.9" } }, contexto);
    });
    const guard = new ThrottlerIpRealGuard({} as any, {} as any, new Reflector());

    await expect((guard as any).handleRequest(props)).resolves.toBe("198.51.100.9");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("preserva o tracker original sem metadata", async () => {
    const handler = jest.fn();
    class ControllerSemMetadata {}
    const contexto = criarContexto(handler, ControllerSemMetadata);
    const trackerOriginal = jest.fn().mockReturnValue("tracker-original");
    const props = {
      context: contexto,
      limit: 1,
      ttl: 60,
      blockDuration: 60,
      throttler: { name: "strict", limit: 1, ttl: 60 },
      getTracker: trackerOriginal,
      generateKey: jest.fn(),
    };
    const spy = jest.spyOn(ThrottlerGuard.prototype as any, "handleRequest").mockImplementation(async (recebidos: any) => {
      expect(recebidos.getTracker).toBe(trackerOriginal);
      return true;
    });
    const guard = new ThrottlerIpRealGuard({} as any, {} as any, new Reflector());

    await expect((guard as any).handleRequest(props)).resolves.toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("expõe a chave de metadata esperada", () => {
    expect(IP_REAL_DO_PROXY).toBe("ipRealDoProxy");
  });
});
