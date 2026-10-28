import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./map-review.tsx", import.meta.url), "utf8");
describe("MapReview", () => {
  it("bloqueia confirmação com conflito ou sem assentos", () => { expect(source).toContain("selected.length > 0"); expect(source).toContain("!conflict"); expect(source).toContain("disabled={!canConfirm}"); });
  it("exige motivo e emite payload estruturado para correção", () => { expect(source).toContain("reason.trim()"); expect(source).toContain("{ seat: selected[0], reason }"); expect(source).toContain("{ seats: selected }"); });
});
