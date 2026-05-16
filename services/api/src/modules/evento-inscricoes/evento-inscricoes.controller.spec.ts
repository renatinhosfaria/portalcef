import fs from "node:fs";
import path from "node:path";

const controllerPath = path.join(
  __dirname,
  "evento-inscricoes.controller.ts",
);

function lerController() {
  return fs.readFileSync(controllerPath, "utf8");
}

describe("EventoInscricoesController", () => {
  it("expõe endpoint autenticado para atualizar presença", () => {
    const source = lerController();

    expect(source).toContain('Patch(":slug/inscricoes/:id/presenca")');
    expect(source).toContain("@CurrentUser()");
    expect(source).toContain("atualizarPresencaSchema.safeParse");
    expect(source).toContain(
      "this.eventoInscricoesService.atualizarPresenca",
    );
  });

  it("expõe endpoints autenticados de sorteio", () => {
    const source = lerController();

    expect(source).toContain('Get(":slug/sorteios")');
    expect(source).toContain('Post(":slug/sorteios")');
    expect(source).toContain("criarSorteioSchema.safeParse");
    expect(source).toContain("this.eventoInscricoesService.listarSorteios");
    expect(source).toContain("this.eventoInscricoesService.sortearBrinde");
  });
});
