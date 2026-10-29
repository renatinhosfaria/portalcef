import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "./workspace-shell";

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
