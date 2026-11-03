import "reflect-metadata";
import { MapasController } from "./mapas.controller";

describe("MapasController", () => {
  it("valida UUID e delega a substituição do mapa padrão", async () => {
    const substituirMapaPadrao = jest.fn().mockResolvedValue({ updated: { id: "evento-1" } });
    const controller = new MapasController({ substituirMapaPadrao } as any);
    const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };
    const mapId = "11111111-1111-4111-8111-111111111111";

    await expect(controller.substituir("evento-1", { mapId }, actor)).resolves.toEqual({ success: true, data: { updated: { id: "evento-1" } } });
    expect(substituirMapaPadrao).toHaveBeenCalledWith("evento-1", mapId, actor);
    await expect(controller.substituir("evento-1", { mapId: "invalido" }, actor)).resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(substituirMapaPadrao).toHaveBeenCalledTimes(1);
  });

  it("expõe a rota administrativa fora do prefixo de mapas", () => {
    const paths = Reflect.getMetadata("path", MapasController) as string;
    const route = Reflect.getMetadata("path", MapasController.prototype.substituir) as string;
    expect(paths).toBe("eventos/admin/:id");
    expect(route).toBe("mapa-padrao/substituir");
  });

  it("repassa a migração e exclusão com corpo parseado e ator", async () => {
    const migrarSessoesEExcluir = jest.fn().mockResolvedValue({ deletedMap: { id: "map-old" } });
    const controller = new MapasController({ migrarSessoesEExcluir } as any);
    const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };
    const input = {
      targetMapId: "22222222-2222-4222-8222-222222222222",
      sessionIds: ["33333333-3333-4333-8333-333333333333"],
    };

    await expect(controller.migrarEExcluir("evento-1", "map-old", input, actor)).resolves.toEqual({
      success: true,
      data: { deletedMap: { id: "map-old" } },
    });
    expect(migrarSessoesEExcluir).toHaveBeenCalledWith("evento-1", "map-old", input, actor);
  });

  it("retorna erro de validação sem chamar o serviço para corpo inválido", async () => {
    const migrarSessoesEExcluir = jest.fn();
    const controller = new MapasController({ migrarSessoesEExcluir } as any);
    const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };

    await expect(controller.migrarEExcluir("evento-1", "map-old", { targetMapId: "invalido", sessionIds: ["tambem-invalido"] }, actor)).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(migrarSessoesEExcluir).not.toHaveBeenCalled();
  });

  it("expõe a rota de migração e exclusão", () => {
    const route = Reflect.getMetadata("path", MapasController.prototype.migrarEExcluir) as string;
    expect(route).toBe("mapas/:versionId/migrar-e-excluir");
  });

  it("importar lê ?pagina como número e recusa página inválida", async () => {
    const importar = jest.fn().mockResolvedValue({ importId: "imp-1" });
    const controller = new MapasController({ importar } as any);
    const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };
    const arquivo = { filename: "planta.pdf" };
    const request: any = { file: jest.fn().mockResolvedValue(arquivo) };

    await controller.importar("evento-1", "2", request, actor);
    expect(importar).toHaveBeenLastCalledWith("evento-1", arquivo, actor, 2);
    await controller.importar("evento-1", undefined, request, actor);
    expect(importar).toHaveBeenLastCalledWith("evento-1", arquivo, actor, undefined);
    importar.mockClear();
    for (const invalida of ["0", "-1", "1.5", "abc"]) {
      await expect(controller.importar("evento-1", invalida, request, actor)).resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    }
    expect(importar).not.toHaveBeenCalled();
  });

  it("lista as versões e envia o original com o content-type", async () => {
    const corpo = { stream: true };
    const listar = jest.fn().mockResolvedValue([{ id: "m1" }]);
    const obterOriginal = jest.fn().mockResolvedValue({ body: corpo, contentType: "application/pdf", contentLength: 10 });
    const controller = new MapasController({ listar, obterOriginal } as any);
    const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };
    await expect(controller.listar("evento-1", actor)).resolves.toEqual([{ id: "m1" }]);
    const reply: any = { header: jest.fn().mockReturnThis(), send: jest.fn().mockReturnValue("enviado") };
    await expect(controller.original("evento-1", "m1", actor, reply)).resolves.toBe("enviado");
    expect(reply.header).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(reply.header).toHaveBeenCalledWith("Content-Length", 10);
    expect(reply.send).toHaveBeenCalledWith(corpo);
  });
});
