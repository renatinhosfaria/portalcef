import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("smoke de Eventos", () => {
  it("mantém uma página renderizável dentro do shell autenticado", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/export default function/);
    expect(source).toContain('redirect("/eventos/inscricoes-evento")');
  });

  it("mantém paginação e exportação completa na tela de inscrições", () => {
    const source = readFileSync(
      new URL("./inscricoes-evento/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("offset");
    expect(source).toContain("Carregar todas as inscrições");
    expect(source).toContain("Página");
  });
});
