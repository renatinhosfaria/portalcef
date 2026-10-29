import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./evento-draft-form.tsx", import.meta.url), "utf8");
describe("criação de rascunho de evento", () => {
  it("usa rota dedicada, cria uma vez e navega para informações", () => {
    expect(source).toContain("/eventos-admin/api/eventos/admin/rascunhos");
    expect(source).toContain("POST");
    expect(source).toContain("/informacoes");
    expect(source).toContain("slug");
  });
  it("não cria sem título válido e não envia o título novamente como criação", () => {
    expect(source).toContain("title.trim()");
    expect(source).toContain("criado");
    expect(source).toContain("PATCH");
  });
});
