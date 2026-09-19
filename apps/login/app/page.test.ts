import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("login e sessão", () => {
  it("redireciona sem serializar a identidade do usuário", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toContain('window.location.href = "https://www.portalcef.com.br/"');
    expect(source).not.toContain("localStorage.setItem(\"tenant\"");
    expect(source).not.toContain("?data=");
  });
});
