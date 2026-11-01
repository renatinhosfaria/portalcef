import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("MapaPage substituição segura", () => {
  it("chama substituição após confirmar a versão", () => {
    expect(source).toContain("/mapa-padrao/substituir");
    expect(source).toContain("body: JSON.stringify({ mapId })");
  });

  it("preserva a versão confirmada quando substituição falha", () => {
    expect(source).toContain('setStatus("CONFIRMADO")');
    expect(source).toContain("setMapaPadraoPendente(true)");
    expect(source).toContain("previousMapArchive");
  });
});
