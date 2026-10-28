import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("vitrine pública de Eventos", () => {
  it("declara pacote público na porta 3014 sem basePath", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.name).toBe("@essencia/eventos");
    expect(pkg.scripts.dev).toContain("3014");
    const config = readFileSync(new URL("../next.config.js", import.meta.url), "utf8");
    expect(config).not.toContain("basePath");
  });

  it("mantém layout anônimo e catálogo com links públicos", () => {
    const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    expect(layout).not.toContain("TenantProvider");
    expect(layout).not.toContain("Shell");
    expect(layout).not.toContain("/api/auth/me");
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page).toContain("Eventos disponíveis");
    const catalog = readFileSync(new URL("../components/catalogo-eventos.tsx", import.meta.url), "utf8");
    expect(catalog).toContain("/evento/");
  });

  it("representa estados de assento sem liberar reservado, vendido ou bloqueado", () => {
    const source = readFileSync(new URL("../components/mapa-assentos.tsx", import.meta.url), "utf8");
    for (const state of ["available", "reserved", "sold", "blocked"]) expect(source).toContain(state);
    expect(source).toContain("disabled");
  });
});

import { classeEstadoAssento } from "../components/mapa-assentos";

describe("comportamento da vitrine", () => {
  it("aplica apresentação visual distinta a cada estado de assento", () => {
    const classes = (["available", "reserved", "sold", "blocked"] as const).map(classeEstadoAssento);
    expect(new Set(classes).size).toBe(4);
    expect(classes[1]).toContain("reserved");
    expect(classes[2]).toContain("sold");
    expect(classes[3]).toContain("blocked");
  });

  it("preserva erro da API separado do estado vazio", () => {
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page).toContain("Não foi possível carregar os eventos");
    expect(page).toContain("role=\"alert\"");
  });
});
