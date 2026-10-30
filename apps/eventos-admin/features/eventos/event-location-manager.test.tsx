import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventLocationManager } from "./event-location-manager";
import type { EventoLocalOption } from "./event-location-contracts";

const local: EventoLocalOption = {
  id: "local-1",
  name: "Auditório Principal",
  address: "Rua das Flores, 10",
  room: "Sala 1",
  instructions: "Entrar pela portaria",
  accessibility: "Rampa",
  isDefault: true,
};

const outroLocal: EventoLocalOption = {
  id: "local-2",
  name: "Quadra coberta",
  address: "Rua das Flores, 12",
  room: null,
  instructions: null,
  accessibility: null,
  isDefault: false,
};

const props = {
  eventId: "evento-1",
  initialItems: [local],
  initialDefaultLocationId: "local-1",
  initialUpdatedAt: "2026-10-30T10:00:00.000Z",
  onChanged: () => undefined,
};

describe("EventLocationManager", () => {
  it("mostra estado vazio acionável", () => {
    const html = renderToStaticMarkup(<EventLocationManager {...props} initialItems={[]} initialDefaultLocationId={null} />);
    expect(html).toContain("Nenhum local cadastrado");
    expect(html).toContain("Adicionar local");
  });

  it("mostra a lista e a confirmação visual do local padrão", () => {
    const html = renderToStaticMarkup(<EventLocationManager {...props} initialItems={[local, outroLocal]} />);
    expect(html).toContain("Auditório Principal");
    expect(html).toContain("Rua das Flores, 10");
    expect(html).toContain("Local padrão");
    expect(html).toContain("Escolher como padrão");
    expect(html).not.toContain("Entrar pela portaria");
  });

  it("mantém os campos obrigatórios acessíveis no formulário inicial", () => {
    const html = renderToStaticMarkup(<EventLocationManager {...props} initialItems={[]} initialDefaultLocationId={null} />);
    expect(html).toContain('aria-label="Nome do local"');
    expect(html).toContain('aria-label="Endereço do local"');
    expect(html).toContain("Campos avançados");
  });
});
