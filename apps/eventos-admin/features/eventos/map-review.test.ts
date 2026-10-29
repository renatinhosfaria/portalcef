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
it("carrega o mapa padrão atual ao abrir a etapa", () => {
  const page = readFileSync(new URL("../../app/eventos/[id]/mapa/page.tsx", import.meta.url), "utf8");
  expect(page).toContain("/eventos-admin/api/eventos/admin/${id}");
  expect(page).toContain("defaultMapId");
  expect(page).toContain("useEffect");
});
it("marca confirmação antes de atualizar herança e não repete confirmação", () => {
  const page = readFileSync(new URL("../../app/eventos/[id]/mapa/page.tsx", import.meta.url), "utf8");
  expect(page).toContain("setStatus(\"CONFIRMADO\")");
  expect(page).toContain("Falha ao atualizar o mapa padrão");
});
it("oferece retry separado para sincronizar o mapa padrão", () => {
  const page = readFileSync(new URL("../../app/eventos/[id]/mapa/page.tsx", import.meta.url), "utf8");
  expect(page).toContain("mapaPadraoPendente");
  expect(page).toContain("onRetryDefaultMap");
});
it("valida success:false nas operações do mapa", () => {
  const page = readFileSync(new URL("../../app/eventos/[id]/mapa/page.tsx", import.meta.url), "utf8");
  expect(page).toContain("body.success === false");
});
