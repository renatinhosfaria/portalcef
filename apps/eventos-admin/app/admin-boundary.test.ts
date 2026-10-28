import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("fronteira do painel administrativo de eventos", () => {
  it("declara pacote, basePath e portas administrativas", () => {
    const manifest = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const config = readFileSync(new URL("../next.config.js", import.meta.url), "utf8");
    expect(manifest).toContain('"name": "@essencia/eventos-admin"');
    expect(manifest).toContain("--port 3016");
    expect(config).toContain('basePath: "/eventos-admin"');
  });

  it("mantém TenantProvider e Shell no layout", () => {
    const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    expect(layout).toContain("TenantProvider");
    expect(layout).toContain("<Shell>");
  });
});
