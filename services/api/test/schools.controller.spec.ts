import fs from "node:fs";
import path from "node:path";

describe("SchoolsController", () => {
  it("mantém a leitura de detalhes disponível para gerente financeiro", () => {
    const controllerPath = path.join(
      __dirname,
      "..",
      "src",
      "modules",
      "schools",
      "schools.controller.ts",
    );
    const content = fs.readFileSync(controllerPath, "utf8");

    expect(content).toContain('@Get(":id")');
    expect(content).toContain('@Roles("gerente_financeiro")');
  });
});
