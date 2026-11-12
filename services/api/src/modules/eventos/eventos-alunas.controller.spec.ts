import { BadRequestException } from "@nestjs/common";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { EVENTOS_ADMIN_ROLES } from "./eventos.constants";
import { EventosAlunasController } from "./eventos-alunas.controller";

const ator = { userId: "u1", schoolId: "s1", role: "diretora_geral" } as any;

function criar() {
  const resposta = { alunas: [], semAluna: 0, totalPagantes: 0 };
  const service = { listar: jest.fn().mockResolvedValue(resposta), juntar: jest.fn().mockResolvedValue(resposta), separar: jest.fn().mockResolvedValue(resposta) };
  return { service, resposta, controller: new EventosAlunasController(service as any) };
}

describe("EventosAlunasController", () => {
  it("declara prefixo, guards na ordem e papéis administrativos", () => {
    expect(Reflect.getMetadata("path", EventosAlunasController)).toBe("eventos/admin/:id");
    expect(Reflect.getMetadata("__guards__", EventosAlunasController)).toEqual([AuthGuard, RolesGuard]);
    expect(Reflect.getMetadata("roles", EventosAlunasController)).toEqual([...EVENTOS_ADMIN_ROLES]);
    expect(Reflect.getMetadata("roles:exact", EventosAlunasController)).toBe(true);
  });

  it("mapeia método e caminho das três rotas", () => {
    const proto = EventosAlunasController.prototype as any;
    const rota = (nome: string) => [Reflect.getMetadata("method", proto[nome]), Reflect.getMetadata("path", proto[nome])];
    expect(rota("listar")).toEqual([0, "alunas"]);
    expect(rota("juntar")).toEqual([1, "alunas/juntar"]);
    expect(rota("separar")).toEqual([1, "alunas/separar"]);
  });

  it("repassa evento, corpo validado e ator", async () => {
    const { controller, service, resposta } = criar();
    await expect(controller.listar("e1", ator)).resolves.toBe(resposta);
    await controller.juntar("e1", { destino: "  Beatriz Santos ", origens: [" Bia "] }, ator);
    await controller.separar("e1", { chave: " bia " }, ator);

    expect(service.listar).toHaveBeenCalledWith("e1", ator);
    expect(service.juntar).toHaveBeenCalledWith("e1", { destino: "Beatriz Santos", origens: ["Bia"] }, ator);
    expect(service.separar).toHaveBeenCalledWith("e1", { chave: "bia" }, ator);
  });

  it("recusa corpo inválido com 400 e não chama o serviço", async () => {
    const { controller, service } = criar();
    for (const corpo of [{ destino: "Beatriz", origens: [] }, { destino: "", origens: ["Bia"] }, { destino: "Beatriz", origens: ["Bia"], extra: 1 }]) {
      await expect(controller.juntar("e1", corpo, ator)).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(controller.separar("e1", { chave: "  " }, ator)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.juntar).not.toHaveBeenCalled();
    expect(service.separar).not.toHaveBeenCalled();
  });
});
