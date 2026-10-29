import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../../app/eventos/[id]/inventario/page.tsx", import.meta.url), "utf8");
const grid = readFileSync(new URL("./inventory-grid.tsx", import.meta.url), "utf8");

describe("inventário operacional", () => {
  it("preserva capacidade por sessão e encaminha para revisão do mapa", () => {
    expect(page).toContain("capacity: Number(row.session?.capacity ?? 0)");
    expect(page).toContain("reviewHref={`/eventos/${id}/mapa`}");
    expect(grid).toContain("Capacidade: {summary.capacity}");
  });

  it("exibe contagens vendáveis e bloqueados por sessão", () => {
    expect(grid).toContain("Vendáveis: {summary.sellable}");
    expect(grid).toContain("Bloqueados: {summary.blocked}");
  });
});
