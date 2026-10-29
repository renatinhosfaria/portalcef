import React from "react";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceShell, normalizarReadiness } from "./workspace-shell";
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
  ])("identifica a etapa ativa para %s", (pathname, expected) => {
    expect(getActiveWorkspaceKey(pathname, [
      { key: "informacoes", label: "Informações", href: "/eventos/evt-1/informacoes", state: "OK" },
      { key: "sessoes", label: "Sessões e local", href: "/eventos/evt-1/sessoes", state: "OK" },
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
    for (const etapa of ["informacoes", "ingressos", "politicas", "revisar"]) {
      expect(existsSync(`${base}/${etapa}/page.tsx`)).toBe(true);
    }
  });
});
