import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("smoke de Eventos", () => {
  it("mantém uma página renderizável dentro do shell autenticado", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/export default function/);
    expect(source).toContain('redirect("/eventos/inscricoes-evento")');
  });
});
