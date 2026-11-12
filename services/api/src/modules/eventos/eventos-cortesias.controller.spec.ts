import { BadRequestException } from "@nestjs/common";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { EVENTOS_ADMIN_ROLES } from "./eventos.constants";
import { EventosCortesiasController } from "./eventos-cortesias.controller";

const ator = { userId: "u1", schoolId: "s1", role: "diretora_geral" } as any;
const assentoId = "11111111-1111-4111-8111-111111111111";
const sessaoId = "22222222-2222-4222-8222-222222222222";

function criar() {
  const service = {
    listar: jest.fn().mockResolvedValue([{ orderId: "p1" }]),
    obterMapaAdmin: jest.fn().mockResolvedValue({ seats: [] }),
    emitir: jest.fn().mockResolvedValue([{ orderId: "p1" }]),
    obterVoucher: jest.fn().mockResolvedValue({ orderId: "p1" }),
    cancelar: jest.fn().mockResolvedValue({ orderId: "p1" }),
  };
  return { service, controller: new EventosCortesiasController(service as any) };
}

describe("EventosCortesiasController", () => {
  it("declara prefixo, guards na ordem e papéis administrativos", () => {
    expect(Reflect.getMetadata("path", EventosCortesiasController)).toBe("eventos/admin/:id");
    expect(Reflect.getMetadata("__guards__", EventosCortesiasController)).toEqual([AuthGuard, RolesGuard]);
    expect(Reflect.getMetadata("roles", EventosCortesiasController)).toEqual([...EVENTOS_ADMIN_ROLES]);
    expect(Reflect.getMetadata("roles:exact", EventosCortesiasController)).toBe(true);
  });

  it("mapeia método e caminho das cinco rotas", () => {
    const proto = EventosCortesiasController.prototype as any;
    const rota = (nome: string) => [Reflect.getMetadata("method", proto[nome]), Reflect.getMetadata("path", proto[nome])];
    expect(rota("listar")).toEqual([0, "cortesias"]);
    expect(rota("mapaAdmin")).toEqual([0, "sessoes/:sessionId/mapa-admin"]);
    expect(rota("emitir")).toEqual([1, "cortesias"]);
    expect(rota("voucher")).toEqual([0, "cortesias/:orderId/voucher"]);
    expect(rota("cancelar")).toEqual([1, "cortesias/:orderId/cancelar"]);
  });

  it("repassa evento, parâmetros e ator nas rotas de leitura", async () => {
    const { controller, service } = criar();
    await expect(controller.listar("e1", ator)).resolves.toEqual([{ orderId: "p1" }]);
    await controller.mapaAdmin("e1", "sess1", ator);
    await controller.voucher("e1", "p1", ator);
    expect(service.listar).toHaveBeenCalledWith("e1", ator);
    expect(service.obterMapaAdmin).toHaveBeenCalledWith("e1", "sess1", ator);
    expect(service.obterVoucher).toHaveBeenCalledWith("e1", "p1", ator);
  });

  it("emite com o corpo validado e devolve o resultado do serviço sem envelope", async () => {
    const { controller, service } = criar();
    const corpo = { sessionId: sessaoId, chave: "chave-12345", grupo: "  Professores ", motivo: "Convidados", assentos: [{ inventorySeatId: assentoId }] };
    await expect(controller.emitir("e1", corpo, ator)).resolves.toEqual([{ orderId: "p1" }]);
    expect(service.emitir).toHaveBeenCalledWith("e1", expect.objectContaining({ grupo: "Professores", sessionId: sessaoId }), ator);
  });

  it("recusa lote sem assentos com 400 e não chama o serviço", async () => {
    const { controller, service } = criar();
    const corpo = { sessionId: sessaoId, chave: "chave-12345", grupo: "Professores", motivo: "Convidados", assentos: [] };
    const erro = (await controller.emitir("e1", corpo, ator).catch((e: unknown) => e)) as BadRequestException;
    expect(erro).toBeInstanceOf(BadRequestException);
    expect(erro.getStatus()).toBe(400);
    expect(erro.getResponse()).toMatchObject({ code: "VALIDATION_ERROR", message: "Dados inválidos", details: expect.any(Object) });
    expect(service.emitir).not.toHaveBeenCalled();
  });

  it("cancela com o motivo validado", async () => {
    const { controller, service } = criar();
    await controller.cancelar("e1", "p1", { motivo: "  Erro de emissão " }, ator);
    expect(service.cancelar).toHaveBeenCalledWith("e1", "p1", { motivo: "Erro de emissão" }, ator);
  });

  it("recusa cancelamento com motivo vazio e não chama o serviço", async () => {
    const { controller, service } = criar();
    await expect(controller.cancelar("e1", "p1", { motivo: "" }, ator)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.cancelar).not.toHaveBeenCalled();
  });
});
