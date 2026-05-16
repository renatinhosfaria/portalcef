import fs from "node:fs";
import path from "node:path";

import { BadRequestException } from "@nestjs/common";

import { EventoInscricoesController } from "./evento-inscricoes.controller";

jest.mock("@essencia/db", () => ({}));

const controllerPath = path.join(
  __dirname,
  "evento-inscricoes.controller.ts",
);

function lerController() {
  return fs.readFileSync(controllerPath, "utf8");
}

describe("EventoInscricoesController", () => {
  function criarController() {
    const service = {
      atualizarPresenca: jest.fn(),
      listarSorteios: jest.fn(),
      obterResumoSorteios: jest.fn(),
      sortearBrinde: jest.fn(),
    };

    const controller = new EventoInscricoesController(service as never);

    return { controller, service };
  }

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
    expect(source).toContain('Get(":slug/sorteios/resumo")');
    expect(source).toContain('Post(":slug/sorteios")');
    expect(source).toContain("criarSorteioSchema.safeParse");
    expect(source).toContain("this.eventoInscricoesService.listarSorteios");
    expect(source).toContain(
      "this.eventoInscricoesService.obterResumoSorteios",
    );
    expect(source).toContain("this.eventoInscricoesService.sortearBrinde");
  });

  it("valida payload e encaminha confirmação de presença com usuário atual", async () => {
    const { controller, service } = criarController();
    service.atualizarPresenca.mockResolvedValue({ id: "inscricao-1" });

    await expect(
      controller.atualizarPresenca(
        "mae-por-inteiro",
        "inscricao-1",
        { presente: true },
        { userId: "usuario-1" },
      ),
    ).resolves.toEqual({ id: "inscricao-1" });

    expect(service.atualizarPresenca).toHaveBeenCalledWith(
      "mae-por-inteiro",
      "inscricao-1",
      true,
      "usuario-1",
    );
  });

  it("rejeita payload inválido de presença antes de chamar o service", async () => {
    const { controller, service } = criarController();

    await expect(
      controller.atualizarPresenca(
        "mae-por-inteiro",
        "inscricao-1",
        { presente: "sim" },
        { userId: "usuario-1" },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(service.atualizarPresenca).not.toHaveBeenCalled();
  });

  it("expõe resumo global de sorteios do evento", async () => {
    const { controller, service } = criarController();
    service.obterResumoSorteios.mockResolvedValue({
      totalInscricoes: 12,
      totalPresentes: 8,
      totalSorteios: 3,
      totalElegiveis: 5,
    });

    await expect(controller.obterResumoSorteios("mae-por-inteiro")).resolves.toEqual(
      {
        totalInscricoes: 12,
        totalPresentes: 8,
        totalSorteios: 3,
        totalElegiveis: 5,
      },
    );

    expect(service.obterResumoSorteios).toHaveBeenCalledWith("mae-por-inteiro");
  });

  it("normaliza payload de brinde antes do sorteio", async () => {
    const { controller, service } = criarController();
    service.sortearBrinde.mockResolvedValue({ id: "sorteio-1" });

    await expect(
      controller.sortearBrinde(
        "mae-por-inteiro",
        { brinde: "  Cesta de café  " },
        { userId: "usuario-1" },
      ),
    ).resolves.toEqual({ id: "sorteio-1" });

    expect(service.sortearBrinde).toHaveBeenCalledWith(
      "mae-por-inteiro",
      "Cesta de café",
      "usuario-1",
    );
  });
});
