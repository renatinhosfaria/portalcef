import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("carrega prontidão real para o shell", () => {
  const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
  expect(source).toContain("/prontidao");
  expect(source).not.toContain("readinessBase");
});
