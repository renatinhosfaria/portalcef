import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("etapa de informações", () => {
  it("identifica visualmente os campos obrigatórios", () => {
    expect(source).toContain("Campos obrigatórios");
    expect(source).toContain('aria-required="true"');
    expect(source).toContain("E-mail de contato");
    expect(source).toContain("Política de cancelamento");
  });

  it("oferece upload de imagem e prévia vinculados ao evento", () => {
    expect(source).toContain('type="file"');
    expect(source).toContain('accept="image/jpeg,image/png,image/webp,image/gif"');
    expect(source).toContain("new FormData()");
    expect(source).toContain("/imagem");
    expect(source).toContain("<img");
    expect(source).toContain("Imagem enviada com sucesso.");
  });
});
