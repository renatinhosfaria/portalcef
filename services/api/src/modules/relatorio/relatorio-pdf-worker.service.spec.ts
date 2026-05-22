jest.mock("./relatorio.service", () => ({
  RelatorioService: class RelatorioService {},
}));

import "reflect-metadata";
import { ConfigService } from "@nestjs/config";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import { RelatorioPdfWorkerService } from "./relatorio-pdf-worker.service";
import { RelatorioService } from "./relatorio.service";

describe("RelatorioPdfWorkerService", () => {
  it("declara RelatorioService como dependência injetável", () => {
    const parametros = Reflect.getMetadata(
      "design:paramtypes",
      RelatorioPdfWorkerService,
    );

    expect(parametros).toEqual([
      ConfigService,
      RelatorioService,
      PdfGeneratorService,
    ]);
  });
});
