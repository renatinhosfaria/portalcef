import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("módulo Eventos", () => {
  it("abre o dashboard administrativo sem redirecionar para o legado", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toContain("EventosPage");
    expect(source).not.toContain("redirect(\"/eventos-admin/inscricoes-evento\")");
    expect(source).toContain("/eventos-admin/api/eventos/admin");
    expect(source).toContain('href="/eventos/novo"');
    expect(source).toContain('href="/eventos"');
  });
  it("preserva o fluxo legado de inscrições", () => {
    const source = readFileSync(new URL("./inscricoes-evento/page.tsx", import.meta.url), "utf8");
    expect(source).toContain("offset");
    expect(source).toContain("Carregar todas as inscrições");
  });
});
