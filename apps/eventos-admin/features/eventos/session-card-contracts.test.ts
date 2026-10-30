import { describe, expect, it } from "vitest";

import { construirPayloadSessao } from "./etapas-contratos";
import { validarSessao, type SessionDraftState } from "./session-card-contracts";

const baseDraft: SessionDraftState = {
  startsAt: "2026-11-01T10:00",
  endsAt: "2026-11-01T12:00",
  capacity: 30,
  salesStartsAt: "2026-10-01T10:00",
  salesEndsAt: "2026-11-01T09:00",
  locationMode: "default",
  mapMode: "default",
  locationId: null,
  mapId: null,
};

describe("contrato do cartão de sessão", () => {
  it("informa cada campo obrigatório ausente", () => {
    const result = validarSessao({
      ...baseDraft,
      startsAt: "",
      endsAt: "",
      capacity: 0,
      salesStartsAt: "2026-11-01T11:00",
      salesEndsAt: "2026-11-01T10:00",
      locationMode: "custom",
      mapMode: "custom",
      locationId: null,
      mapId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.objectContaining({
      startsAt: expect.any(String),
      endsAt: expect.any(String),
      capacity: expect.any(String),
      location: expect.any(String),
      map: expect.any(String),
    }));
  });

  it("aceita sessão sem janela de vendas definida", () => {
    const result = validarSessao({ ...baseDraft, salesStartsAt: "", salesEndsAt: "" });

    expect(result.ok).toBe(true);
    expect(result.errors.salesStartsAt).toBeUndefined();
    expect(result.errors.salesEndsAt).toBeUndefined();
  });

  it("rejeita datas invertidas", () => {
    const result = validarSessao({
      ...baseDraft,
      startsAt: "2026-11-01T13:00",
      endsAt: "2026-11-01T12:00",
      salesStartsAt: "2026-11-01T11:00",
      salesEndsAt: "2026-11-01T10:00",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.startsAt).toBeTruthy();
    expect(result.errors.salesStartsAt).toBeTruthy();
  });

  it("rejeita capacidade não inteira ou menor que um", () => {
    expect(validarSessao({ ...baseDraft, capacity: 1.5 }).errors.capacity).toBeTruthy();
    expect(validarSessao({ ...baseDraft, capacity: 0 }).errors.capacity).toBeTruthy();
  });

  it("converte os modos visuais em IDs do payload", () => {
    expect(construirPayloadSessao({ ...baseDraft, locationMode: "default", mapMode: "default", locationId: "local-1", mapId: "mapa-1" })).toEqual(expect.objectContaining({ locationId: null, mapId: null }));
    expect(construirPayloadSessao({ ...baseDraft, locationMode: "custom", mapMode: "custom", locationId: "local-1", mapId: "mapa-1" })).toEqual(expect.objectContaining({ locationId: "local-1", mapId: "mapa-1" }));
  });
});
