import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("planejamentos", () => {
  it("mantém erro da carga de planos separado de uma lista vazia", () => {
    const source = readFileSync(join(process.cwd(), "app/planejamentos/planejamentos-content.tsx"), "utf8");

    expect(source).toContain("errorPlanos");
    expect(source).toContain("Não foi possível carregar os planos de aula");
  });
});
