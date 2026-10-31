import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("etapa de ingressos", () => {
  it("atualiza o readiness do Workspace após o autosave", () => {
    expect(source).toContain("useRouter");
    expect(source).toContain("onSaved: () => router.refresh()");
  });
});
