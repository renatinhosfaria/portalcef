import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./map-review.tsx", import.meta.url), "utf8");
describe("MapReview", () => {
  it("bloqueia confirmação com conflito ou sem assentos", () => { expect(source).toContain("!items.length"); expect(source).toContain("items.some(x=>x.conflict)"); });
  it("exige motivo e emite payload estruturado para correção", () => { expect(source).toContain("reason.trim()"); expect(source).toContain("seat:items[0],reason"); expect(source).toContain("seats:items"); });
});
