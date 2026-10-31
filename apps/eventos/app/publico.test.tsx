import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogoPublico } from "./page";

describe("vitrine pública de Eventos", () => {
  it("declara pacote público na porta 3014 sem basePath", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.name).toBe("@essencia/eventos");
    expect(pkg.scripts.dev).toContain("3014");
    const config = readFileSync(new URL("../next.config.js", import.meta.url), "utf8");
    expect(config).not.toContain("basePath");
  });

  it("declara as dependências e a configuração compartilhada da fundação visual", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.dependencies["@essencia/ui"]).toBe("workspace:*");
    expect(pkg.dependencies["@essencia/tailwind-config"]).toBe("workspace:*");

    const tailwind = readFileSync(new URL("../tailwind.config.ts", import.meta.url), "utf8");
    expect(tailwind).toContain("@essencia/tailwind-config");
    expect(tailwind).toContain("packages/ui");
  });

  it("transpila a UI e permite imagens do storage público", () => {
    const config = readFileSync(new URL("../next.config.js", import.meta.url), "utf8");
    expect(config).toContain('"@essencia/ui"');
    expect(config).toContain('"@essencia/shared"');
    expect(config).toContain('hostname: "www.portalcef.com.br"');
    expect(config).toContain('pathname: "/storage/**"');
    expect(config).toContain('protocol: "https", hostname: "minio.essencia.edu.br"');
    expect(config).toContain('pathname: "/essencia-uploads/**"');
    expect(config).toContain('protocol: "http", hostname: "localhost", port: "9000"');
  });

  it("mantém layout anônimo e catálogo com links públicos", () => {
    const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    expect(layout).toContain('lang="pt-BR"');
    expect(layout).toContain("export const metadata");
    expect(layout).toContain("export const viewport");
    expect(layout).toContain("/pedido/consulta");
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

  it("renderiza comportamentalmente erro e catálogo vazio como estados distintos", () => {
    const erro = renderToStaticMarkup(<CatalogoPublico events={[]} error />);
    const vazio = renderToStaticMarkup(<CatalogoPublico events={[]} error={false} />);
    expect(erro).toContain("Não foi possível carregar os eventos");
    expect(erro).toContain('role="alert"');
    expect(erro).not.toContain("Nenhum evento disponível");
    expect(vazio).toContain("Nenhum evento disponível");
    expect(vazio).not.toContain('role="alert"');
  });
});
