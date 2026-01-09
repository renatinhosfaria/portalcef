const fs = require("fs");
const path = require("path");

describe("SchoolsController", () => {
  it("allows gerente_financeiro to read school details", () => {
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
