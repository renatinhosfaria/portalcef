import React from "react";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceShell, normalizarReadiness, type WorkspaceReadiness } from "./workspace-shell";
import { getActiveWorkspaceKey } from "./workspace-navigation";

const readiness = {
  status: "RASCUNHO" as const,
  progress: 2,
  items: [
    { key: "informacoes", label: "Informações", state: "OK" as const, href: "/eventos/evt-1/informacoes" },
    { key: "sessoes", label: "Sessões e local", state: "BLOQUEADOR" as const, href: "/eventos/evt-1/sessoes", message: "Adicione uma sessão" },
  ],
};

describe("WorkspaceShell de eventos", () => {
  it("renderiza as seis etapas, identidade Portal CEF e conteúdo", () => {
    const html = renderToStaticMarkup(
      <WorkspaceShell eventId="evt-1" readiness={readiness} saveState="saved" lastSavedAt="2026-10-29T12:00:00.000Z">
        <p>Conteúdo da etapa</p>
      </WorkspaceShell>,
    );

    expect(html).toContain("Portal CEF");
    expect(html).toContain("Informações");
    expect(html).toContain("Sessões e local");
    expect(html).toContain("Mapa e lugares");
    expect(html).toContain("Ingressos");
    expect(html).toContain("Políticas");
    expect(html).toContain("Cortesias");
    expect(html).toContain('href="/eventos/evt-1/cortesias"');
    expect(html).toContain("Alunas convidadas");
    expect(html).toContain('href="/eventos/evt-1/alunas"');
    expect(html).toContain("Revisar e publicar");
    expect(html).toContain("Salvo agora");
    expect(html).toContain("Adicione uma sessão");
    expect(html).toContain("Conteúdo da etapa");
  });

  it("indica status do evento e pendências com link acionável", () => {
    const html = renderToStaticMarkup(
      <WorkspaceShell eventId="evt-1" readiness={{ ...readiness, status: "PUBLICADO" }} saveState="error">
        <p />
      </WorkspaceShell>,
    );

    expect(html).toContain("PUBLICADO");
    expect(html).toContain("Não foi possível salvar");
    expect(html).toContain('href="/eventos/evt-1/sessoes"');
    expect(html).toContain('aria-current="page"');
  });
});


describe("navegação e readiness do workspace", () => {
  it.each([
    ["/eventos/evt-1/sessoes", "sessoes"],
    ["/eventos/evt-1/mapa", "mapa"],
    ["/eventos-admin/eventos/evt-1/mapa", "mapa"],
    ["/eventos-admin/eventos/evt-1/sessoes", "sessoes"],
  ])("identifica a etapa ativa para %s", (pathname, expected) => {
    expect(getActiveWorkspaceKey(pathname, [
      { key: "informacoes", label: "Informações", href: "/eventos/evt-1/informacoes", state: "OK" },
      { key: "sessoes", label: "Sessões e local", href: pathname.endsWith("sessoes") ? "/eventos/evt-1/sessoes#sessoes" : "/eventos/evt-1/sessoes", state: "OK" },
      { key: "mapa", label: "Mapa e lugares", href: "/eventos/evt-1/mapa", state: "OK" },
    ])).toBe(expected);
  });

  it("agrupa as chaves de prontidão da API nas etapas e deriva revisão", () => {
    const itens = normalizarReadiness("evt-1", [
      { key: "TEXTOS_OBRIGATORIOS", label: "Textos obrigatórios", state: "OK", href: "#informacoes" },
      { key: "SESSAO_OBRIGATORIA", label: "Sessão obrigatória", state: "OK", href: "#sessoes" },
      { key: "LOCAL_SESSOES", label: "Local das sessões", state: "BLOQUEADOR", href: "#sessoes", message: "Informe o local" },
      { key: "INVENTARIO_SESSOES", label: "Inventário", state: "BLOQUEADOR", href: "#mapa", message: "Revise o inventário" },
      { key: "INGRESSO_OBRIGATORIO", label: "Ingresso", state: "BLOQUEADOR", href: "#ingressos", message: "Crie um ingresso" },
    ]);
    expect(itens.find((item) => item.key === "informacoes")?.state).toBe("OK");
    expect(itens.find((item) => item.key === "sessoes")?.state).toBe("BLOQUEADOR");
    expect(itens.find((item) => item.key === "mapa")?.state).toBe("BLOQUEADOR");
    expect(itens.find((item) => item.key === "ingressos")?.state).toBe("BLOQUEADOR");
    expect(itens.find((item) => item.key === "sessoes")?.href).toBe("/eventos/evt-1/sessoes#sessoes");
    expect(itens.find((item) => item.key === "revisar")?.state).toBe("BLOQUEADOR");
  });

  it("mantém destinos mínimos para todas as etapas navegáveis", () => {
    const base = fileURLToPath(new URL("../../app/eventos/[id]", import.meta.url));
    for (const etapa of ["informacoes", "ingressos", "politicas", "alunas", "revisar"]) {
      expect(existsSync(`${base}/${etapa}/page.tsx`)).toBe(true);
    }
  });
});

describe("itens do mapa e cortesias na navegação", () => {
  const renderizar = (itens: WorkspaceReadiness["items"]) => renderToStaticMarkup(
    <WorkspaceShell eventId="evt-1" readiness={{ ...readiness, items: itens }} saveState="saved"><p /></WorkspaceShell>,
  );
  const rotulos = (html: string) => Array.from(html.matchAll(/<li>(.*?)<\/li>/g)).map((m) => m[1]);
  const textos = (li: string) => li.replace(/<[^>]+>/g, "|").split("|").filter(Boolean);

  it("mostra Cortesias e Alunas convidadas logo depois de Inventário, sem rótulo de estado", () => {
    const itens = rotulos(renderizar(readiness.items));
    const nomes = itens.map((li) => textos(li)[0]);
    expect(nomes.indexOf("Cortesias")).toBe(nomes.indexOf("Inventário") + 1);
    expect(textos(itens[nomes.indexOf("Cortesias")])).toEqual(["Cortesias"]);
    expect(nomes.indexOf("Alunas convidadas")).toBe(nomes.indexOf("Cortesias") + 1);
    expect(textos(itens[nomes.indexOf("Alunas convidadas")])).toEqual(["Alunas convidadas"]);
  });

  it("Inventário também não mostra rótulo de estado do mapa", () => {
    const itens = rotulos(renderizar([{ key: "MAPA_CONFIRMADO", label: "Mapa", state: "BLOQUEADOR", message: "Confirme o mapa" }]));
    const inventario = itens.find((li) => textos(li)[0] === "Inventário")!;
    expect(textos(inventario)).toEqual(["Inventário"]);
    expect(inventario).not.toContain("Pendente");
  });

  it("Cortesias não altera progresso nem o estado de Revisar e publicar", () => {
    const base = normalizarReadiness("evt-1", readiness.items);
    const html = renderizar(readiness.items);
    expect(base.map((i) => i.key)).not.toContain("cortesias");
    expect(base.find((i) => i.key === "revisar")?.state).toBe("BLOQUEADOR");
    expect(html).not.toContain("Cortesias</span><span");
  });
});
