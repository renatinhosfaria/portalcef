import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { confirmarRemocaoSessao, SessionEditor, sessionDraftToValue, sessionValueToDraft, type SessionValue } from "./session-editor";
import type { SessionOptions } from "./session-card-contracts";

const options: SessionOptions = {
  defaultLocation: { id: "local-padrao", name: "Auditório Principal", address: "Rua das Flores, 10", room: "Sala 1" },
  locations: [
    { id: "local-padrao", name: "Auditório Principal", address: "Rua das Flores, 10", room: "Sala 1" },
    { id: "local-quadra", name: "Quadra Coberta", address: "Rua das Flores, 12", room: null },
  ],
  defaultMap: { id: "mapa-padrao", version: 3, status: "CONFIRMADO", originalFileName: "auditório-v3.csv" },
  maps: [
    { id: "mapa-padrao", version: 3, status: "CONFIRMADO", originalFileName: "auditório-v3.csv" },
    { id: "mapa-alternativo", version: 2, status: "CONFIRMADO", originalFileName: "quadra-v2.csv" },
  ],
};

const pronta: SessionValue = {
  id: "sessao-1",
  startsAt: "2026-11-01T10:00",
  endsAt: "2026-11-01T12:00",
  capacity: 30,
  salesStartsAt: "2026-10-01T10:00",
  salesEndsAt: "2026-11-01T09:00",
  inheritLocation: true,
  inheritMap: true,
  locationId: null,
  mapId: null,
};

describe("SessionEditor", () => {
  it("renderiza cartões guiados com opções legíveis e blocos de preenchimento", () => {
    const html = renderToStaticMarkup(<SessionEditor initialValue={[{ ...pronta, inheritLocation: false, inheritMap: false, locationId: "local-quadra", mapId: "mapa-alternativo" }]} options={options} />);

    expect(html).toContain("Sessão 1");
    expect(html).toContain("Quando acontece");
    expect(html).toContain("Capacidade e vendas");
    expect(html).toContain("Local");
    expect(html).toContain("Mapa de assentos");
    expect(html).toContain("Quadra Coberta");
    expect(html).toContain("Mapa v2");
    expect(html).toContain("quadra-v2.csv");
    expect(html).toContain("Pronta");
  });

  it("mostra a herança inicial e os padrões atuais do evento", () => {
    const html = renderToStaticMarkup(<SessionEditor initialValue={[pronta]} options={options} />);

    expect(html).toContain("Usar local padrão");
    expect(html).toContain("Auditório Principal");
    expect(html).toContain("Usar mapa padrão");
    expect(html).toContain("auditório-v3.csv");
    expect(html).toContain('value="default"');
    expect(html).toContain('checked=""');
    expect(html).not.toContain('aria-label="Local da exceção"');
  });

  it("expande seletores avançados somente ao escolher uma exceção", () => {
    const html = renderToStaticMarkup(<SessionEditor initialValue={[{ ...pronta, inheritLocation: false, inheritMap: false, locationId: "local-quadra", mapId: "mapa-alternativo" }]} options={options} />);

    expect(html).toContain('aria-label="Local da exceção"');
    expect(html).toContain('aria-label="Mapa da exceção"');
    expect(html).toContain("Escolha um local específico");
    expect(html).toContain("Escolha um mapa específico");
  });

  it("exibe a pendência específica quando a sessão está incompleta", () => {
    const html = renderToStaticMarkup(<SessionEditor initialValue={[{ ...pronta, startsAt: "", inheritLocation: false, locationId: null }]} options={options} />);

    expect(html).toContain("Falta horário de início");
    expect(html).toContain("Escolha um local para esta sessão");
    expect(html).toContain("Revise os campos destacados antes de salvar");
  });

  it("mantém IDs e modos visuais no valor emitido ao autosave", () => {
    const draft = sessionValueToDraft({ ...pronta, inheritLocation: false, inheritMap: false, locationId: "local-quadra", mapId: "mapa-alternativo" });

    expect(sessionDraftToValue(draft)).toMatchObject({
      id: "sessao-1",
      inheritLocation: false,
      inheritMap: false,
      locationId: "local-quadra",
      mapId: "mapa-alternativo",
    });
  });

  it("exige confirmação para remoção persistida e remove rascunho imediatamente", () => {
    const confirmar = vi.fn(() => false);

    expect(confirmarRemocaoSessao({ ...pronta, id: undefined }, confirmar)).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
    expect(confirmarRemocaoSessao(pronta, confirmar)).toBe(false);
    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining("sessão já foi salva"));
  });

  it("liga cada controle à mensagem de erro do próprio campo", () => {
    const html = renderToStaticMarkup(<SessionEditor initialValue={[{ ...pronta, startsAt: "", capacity: 0 }]} options={options} />);

    expect(html).toContain('aria-describedby="campo-0-inicio-erro"');
    expect(html).toContain('id="campo-0-inicio-erro"');
    expect(html).toContain('aria-describedby="campo-0-capacidade-erro"');
    expect(html).toContain('id="campo-0-capacidade-erro"');
  });

  it("oferece remoção local sem exigir identificador persistido", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(<SessionEditor initialValue={[{ ...pronta, id: undefined }]} options={options} onChange={onChange} onRemove={vi.fn()} />);

    expect(html).toContain("Remover sessão 1");
    expect(html).toContain("Adicionar sessão");
    expect(onChange).not.toHaveBeenCalled();
  });
});
