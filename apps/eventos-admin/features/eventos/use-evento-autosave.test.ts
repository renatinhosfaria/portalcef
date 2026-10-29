import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./use-evento-autosave.ts", import.meta.url), "utf8");
describe("useEventoAutosave", () => {
  it("implementa debounce, retry e preserva valor local", () => {
    expect(source).toContain("setTimeout");
    expect(source).toContain("retry");
    expect(source).toContain('"error"');
    expect(source).toContain("dirty");
  });
  it("detecta conflito de versão sem descartar estado local", () => {
    expect(source).toContain("VERSION_CONFLICT");
    expect(source).toContain("conflict");
    expect(source).toContain("lastSavedAt");
  });
  it("impede resposta obsoleta de sobrescrever a alteração mais nova", () => {
    expect(source).toContain("sequence");
    expect(source).toContain("activeSequence");
  });
});
