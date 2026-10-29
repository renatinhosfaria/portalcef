import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

for (const etapa of ["informacoes", "ingressos", "politicas"]) {
  it(`captura a revisão antes da requisição em ${etapa}`, () => {
    const source = readFileSync(new URL(`../../app/eventos/[id]/${etapa}/page.tsx`, import.meta.url), "utf8");
    const revision = source.indexOf("const revision = changeRevision.current");
    const fetch = source.indexOf("await fetch", revision);
    expect(revision).toBeGreaterThanOrEqual(0);
    expect(fetch).toBeGreaterThan(revision);
    expect(source).toContain("changeRevision.current === revision");
  });
}
