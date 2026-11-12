import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("aba de cortesias", () => {
  it("carrega sessões e cortesias, e recarrega após emitir ou cancelar", () => {
    expect(source).toContain('"use client"');
    expect(source).toContain("/sessoes");
    expect(source).toContain("listarCortesias");
    expect(source).toContain("EmitirCortesias");
    expect(source).toContain("ListaCortesias");
    expect(source).toContain("aoEmitir");
    expect(source).toContain("aoCancelar");
  });
});
