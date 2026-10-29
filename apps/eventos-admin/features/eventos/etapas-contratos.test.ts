import { describe, expect, it } from "vitest";
import {
  assertRespostaApi,
  construirPayloadInformacoes,
  construirPayloadIngresso,
  ingressosProntosParaSalvar,
  construirPayloadPoliticas,
  construirPayloadSessao,
  slugSugerido,
  mesclarSessaoSalva,
  persistirSessaoSalva,
} from "./etapas-contratos";

describe("contratos das etapas do workspace", () => {
  it("sugere slug a partir do título sem substituir edição manual", () => {
    expect(slugSugerido("Feira de Ciências 2026")).toBe("feira-de-ciencias-2026");
    expect(slugSugerido("Feira & Ação")).toBe("feira-acao");
  });

  it("envia somente campos de informações", () => {
    expect(construirPayloadInformacoes({ title: "Evento", slug: "evento", summary: "Resumo", description: "Descrição", imageUrl: "", category: "Feira", contactEmail: "a@b.com", contactPhone: "", cancellationPolicy: "Regra" })).toEqual({
      title: "Evento", slug: "evento", summary: "Resumo", description: "Descrição", imageUrl: null, category: "Feira", contactEmail: "a@b.com", contactPhone: null, cancellationPolicy: "Regra",
    });
  });

  it("preserva herança de local e mapa na sessão", () => {
    expect(construirPayloadSessao({ startsAt: "2026-11-01T10:00", endsAt: "2026-11-01T12:00", capacity: 30, salesStartsAt: "", salesEndsAt: "", inheritLocation: true, inheritMap: true, locationId: "local", mapId: "mapa" })).toEqual(expect.objectContaining({ locationId: null, mapId: null, capacity: 30 }));
    expect(construirPayloadSessao({ startsAt: "2026-11-01T10:00", endsAt: "2026-11-01T12:00", capacity: 30, salesStartsAt: "", salesEndsAt: "", inheritLocation: false, inheritMap: false, locationId: "local", mapId: "mapa" })).toEqual(expect.objectContaining({ locationId: "local", mapId: "mapa" }));
  });

  it("mantém preço de ingresso em centavos", () => {
    expect(construirPayloadIngresso({ name: "Inteira", priceCents: 1250, eligibility: "Famílias", salesLot: "Lote 1", rules: { idadeMinima: 6 } })).toEqual({ name: "Inteira", priceCents: 1250, eligibility: "Famílias", salesLot: "Lote 1", rules: { idadeMinima: 6 } });
  });

  it("não considera ingresso incompleto pronto para autosave", () => {
    expect(ingressosProntosParaSalvar([{ name: "", priceCents: 0 }])).toBe(false);
    expect(ingressosProntosParaSalvar([{ name: "Inteira", priceCents: 0 }])).toBe(true);
  });

  it("exige e normaliza as cinco políticas obrigatórias", () => {
    const policies = ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"].map((type) => ({ type, content: `Texto ${type}` }));
    expect(construirPayloadPoliticas(policies)).toEqual(policies);
    expect(() => construirPayloadPoliticas(policies.slice(0, 4))).toThrow("cinco políticas");
  });

  it("trata success:false como falha mesmo com HTTP 200 e preserva código/status", () => {
    expect(() => assertRespostaApi({ ok: true, status: 200, body: { success: false, error: { code: "VERSION_CONFLICT" } } })).toThrowError(expect.objectContaining({ code: "VERSION_CONFLICT", status: 409 }));
  });

  it("incorpora o id retornado ao criar uma sessão", () => {
    expect(mesclarSessaoSalva({ startsAt: "a", endsAt: "b", capacity: 1, salesStartsAt: "", salesEndsAt: "", inheritLocation: true, inheritMap: true }, { id: "sessao-1" })).toMatchObject({ id: "sessao-1" });
  });

  it("persiste o id incrementalmente antes de uma próxima tentativa", () => {
    const sessions = [{ startsAt: "a", endsAt: "b", capacity: 1, salesStartsAt: "", salesEndsAt: "", inheritLocation: true, inheritMap: true }, { startsAt: "c", endsAt: "d", capacity: 1, salesStartsAt: "", salesEndsAt: "", inheritLocation: true, inheritMap: true }];
    expect(persistirSessaoSalva(sessions, 0, { id: "sessao-1" })[0]).toMatchObject({ id: "sessao-1" });
  });
});
