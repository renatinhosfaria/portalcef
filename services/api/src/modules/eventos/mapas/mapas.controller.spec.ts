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
});
