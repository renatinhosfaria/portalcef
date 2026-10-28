import fs from "fs";
import path from "path";

describe("configuração do Jest da API", () => {
  it("mapeia os pacotes workspace para shims executáveis pelo Jest", () => {
    const configuração = fs.readFileSync(
      path.resolve(__dirname, "../../jest.config.js"),
      "utf8",
    );

    expect(configuração).toContain("<rootDir>/test/db-jest-shim.ts");
    expect(configuração).toContain(
      "<rootDir>/test/shared-schemas-jest-shim.ts",
    );
  });
});
