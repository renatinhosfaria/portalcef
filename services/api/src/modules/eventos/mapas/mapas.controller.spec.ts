import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { MapasController } from "./mapas.controller";
import { MAX_PLANTA_PDF_BYTES } from "./mapas.service";

describe("MapasController", () => {
  it("não expõe mais arquivar, substituir, migrar-e-excluir nem PATCH mapa-padrao", () => {
    const caminhos = Object.getOwnPropertyNames(MapasController.prototype)
      .filter((nome) => nome !== "constructor")
      .map((nome) => Reflect.getMetadata("path", (MapasController.prototype as any)[nome]) as string | undefined);

    expect(caminhos).not.toContain("mapas/:versionId/arquivar");
    expect(caminhos).not.toContain("mapa-padrao/substituir");
    expect(caminhos).not.toContain("mapas/:versionId/migrar-e-excluir");
  });

  it("importar lê ?pagina como número e recusa página inválida", async () => {
    const importar = jest.fn().mockResolvedValue({ importId: "imp-1" });
    const controller = new MapasController({ importar } as any);
    const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };
    const arquivo = { filename: "planta.pdf" };
    const request: any = { file: jest.fn().mockResolvedValue(arquivo) };

    await controller.importar("evento-1", "2", request, actor);
    expect(request.file).toHaveBeenCalledWith({ limits: { fileSize: MAX_PLANTA_PDF_BYTES } });
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
    expect(reply.header).toHaveBeenCalledWith("Content-Disposition", 'inline; filename="planta.pdf"');
    expect(reply.header).toHaveBeenCalledWith("Content-Length", 10);
    expect(reply.send).toHaveBeenCalledWith(corpo);
  });
  it("valida o corpo de proposta e publicar com zod", async () => {
    const editarProposta = jest.fn().mockResolvedValue({ revisao: 4 });
    const publicar = jest.fn().mockResolvedValue({ map: { id: "m1" } });
    const controller = new MapasController({ editarProposta, publicar } as any);
    const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };
    const operacoes = [{ tipo: "CONFERIR_PONTO", pontoId: "p1" }];

    await expect(controller.editarProposta("evento-1", "m1", { revisaoBase: 3, operacoes }, actor)).resolves.toEqual({ success: true, data: { revisao: 4 } });
    expect(editarProposta).toHaveBeenCalledWith("evento-1", "m1", { revisaoBase: 3, operacoes }, actor);
    for (const corpo of [{ revisaoBase: -1, operacoes }, { revisaoBase: 1.5, operacoes }, { revisaoBase: 1, operacoes: [] }, { revisaoBase: 1, operacoes: [{ tipo: "INVENTADA" }] }, {}]) {
      await expect(controller.editarProposta("evento-1", "m1", corpo, actor)).resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    }
    expect(editarProposta).toHaveBeenCalledTimes(1);

    await expect(controller.publicar("evento-1", "m1", { revisaoBase: 0, motivo: "  ok  " }, actor)).resolves.toEqual({ success: true, data: { map: { id: "m1" } } });
    expect(publicar).toHaveBeenLastCalledWith("evento-1", "m1", { revisaoBase: 0, motivo: "ok" }, actor);
    await controller.publicar("evento-1", "m1", { revisaoBase: 2, motivo: "   " }, actor);
    expect(publicar).toHaveBeenLastCalledWith("evento-1", "m1", { revisaoBase: 2, motivo: undefined }, actor);
    for (const corpo of [{}, { revisaoBase: -1 }, { revisaoBase: 1, motivo: "x".repeat(501) }]) {
      await expect(controller.publicar("evento-1", "m1", corpo, actor)).resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    }
    expect(publicar).toHaveBeenCalledTimes(2);
  });

  it("expõe as rotas de proposta e publicar", () => {
    expect(Reflect.getMetadata("path", MapasController.prototype.editarProposta)).toBe("mapas/:versionId/proposta");
    expect(Reflect.getMetadata("path", MapasController.prototype.publicar)).toBe("mapas/:versionId/publicar");
  });

  it("POST mapas/:versionId/editar responde com o novo id do mapa", async () => {
    const editarVersao = jest.fn().mockResolvedValue({ mapId: "map-new" });
    const controller = new MapasController({ editarVersao } as any);
    const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };
    await expect(controller.editarVersao("evento-1", "map-old", actor)).resolves.toEqual({ success: true, data: { mapId: "map-new" } });
    expect(editarVersao).toHaveBeenCalledWith("evento-1", "map-old", actor);
    expect(Reflect.getMetadata("path", MapasController.prototype.editarVersao)).toBe("mapas/:versionId/editar");
  });

  it("DELETE mapas/:versionId responde com a exclusão e as sessões levadas", async () => {
    const excluirVersao = jest.fn().mockResolvedValue({ excluida: true, sessionIds: ["sessao-1"] });
    const controller = new MapasController({ excluirVersao } as any);
    const actor = { userId: "user-1", role: "diretora_geral", schoolId: "school-1" };
    await expect(controller.excluirVersao("evento-1", "map-old", actor)).resolves.toEqual({ success: true, data: { excluida: true, sessionIds: ["sessao-1"] } });
    expect(excluirVersao).toHaveBeenCalledWith("evento-1", "map-old", actor);
    expect(Reflect.getMetadata("path", MapasController.prototype.excluirVersao)).toBe("mapas/:versionId");
    expect(Reflect.getMetadata("method", MapasController.prototype.excluirVersao)).toBe(RequestMethod.DELETE);
  });

  it("não expõe mais deteccoes nem confirmar", () => {
    const caminhos = Object.getOwnPropertyNames(MapasController.prototype)
      .filter((nome) => nome !== "constructor")
      .map((nome) => Reflect.getMetadata("path", (MapasController.prototype as any)[nome]) as string | undefined);
    expect(caminhos).not.toContain("mapas/:versionId/deteccoes");
    expect(caminhos).not.toContain("mapas/:versionId/confirmar");
    expect((MapasController.prototype as any).atualizar).toBeUndefined();
    expect((MapasController.prototype as any).confirmar).toBeUndefined();
  });
});
