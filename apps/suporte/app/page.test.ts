import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("smoke de Suporte", () => {
  it("mantém a página principal como componente React", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/export default function/);
    expect(source).toContain("useTenant");
  });
});
