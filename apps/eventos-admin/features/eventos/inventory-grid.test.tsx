import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./inventory-grid.tsx", import.meta.url), "utf8");

describe("InventoryGrid somente leitura", () => {
  it("não expõe ações administrativas antigas", () => {
    expect(source).not.toContain("onAction");
    expect(source).not.toContain("cortesia");
    expect(source).not.toContain("reservar");
    expect(source).not.toContain("Motivo obrigatório");
  });
});
