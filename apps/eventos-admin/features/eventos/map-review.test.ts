import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./map-review.tsx", import.meta.url), "utf8");
describe("MapReview", () => {
  it("bloqueia confirmação com conflito ou sem assentos", () => { expect(source).toContain("!items.length"); expect(source).toContain("items.some(x=>x.conflict)"); });
  it("exige motivo e emite payload estruturado para correção", () => { expect(source).toContain("reason.trim()"); expect(source).toContain("seats:[current],reason"); expect(source).toContain("seats:items"); });
});
it("usa estado do mapa e rota de mapa padrão para refletir revisão", () => {
  const page = readFileSync(new URL("../../app/eventos/[id]/mapa/page.tsx", import.meta.url), "utf8");
  expect(page).toContain("mapa-padrao");
  expect(page).toContain("x.map?.status");
});
it("não calcula prontidão global no grid", () => {
  const source = readFileSync(new URL("./inventory-grid.tsx", import.meta.url), "utf8");
  expect(source).not.toContain("Inventário pronto para a capacidade");
});
