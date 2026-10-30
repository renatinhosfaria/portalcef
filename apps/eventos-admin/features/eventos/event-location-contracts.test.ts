import { describe, expect, it } from "vitest";
import {
  construirPayloadLocal,
  construirPayloadPadrao,
  normalizarRespostaLocais,
  validarLocal,
  type EventoLocalOption,
} from "./event-location-contracts";

const local: EventoLocalOption = {
  id: "local-1",
  name: "Auditório Principal",
  address: "Rua das Flores, 10",
  room: "Sala 1",
  instructions: "Entrar pela portaria",
  accessibility: "Rampa",
  isDefault: true,
};

describe("contratos do gerenciador de locais", () => {
  it("exige nome e endereço depois de remover espaços", () => {
    expect(validarLocal({ ...local, name: "  ", address: "Rua" })).toEqual({
      ok: false,
      errors: { name: "Informe o nome do local." },
    });
    expect(validarLocal({ ...local, name: "Nome", address: "   " })).toEqual({
      ok: false,
      errors: { address: "Informe o endereço do local." },
    });
  });

  it("monta payload sem id e sem isDefault, mantendo campos avançados nulos", () => {
    expect(construirPayloadLocal({
      name: " Auditório ",
      address: " Rua A ",
      room: " ",
      instructions: "",
      accessibility: null,
    })).toEqual({
      name: "Auditório",
      address: "Rua A",
      room: null,
      instructions: null,
      accessibility: null,
    });
  });

  it("usa defaultLocationId no PATCH do padrão", () => {
    expect(construirPayloadPadrao("local-1", "2026-10-30T10:00:00.000Z")).toEqual({
      defaultLocationId: "local-1",
      expectedUpdatedAt: "2026-10-30T10:00:00.000Z",
    });
    expect(construirPayloadPadrao(null, null)).toEqual({ defaultLocationId: null });
  });

  it("normaliza envelope de locais e aplica o padrão mesmo quando a linha não o marca", () => {
    expect(normalizarRespostaLocais({
      success: true,
      data: {
        items: [{ ...local, isDefault: false }],
        defaultLocationId: "local-1",
        updatedAt: "2026-10-30T10:00:00.000Z",
      },
    })).toEqual({
      items: [{ ...local, isDefault: true }],
      defaultLocationId: "local-1",
      updatedAt: "2026-10-30T10:00:00.000Z",
    });
  });
});
