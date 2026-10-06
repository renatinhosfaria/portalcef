import { describe, expect, it } from "vitest";

import {
  montarContextosFormulario,
  normalizarDataHoraFormulario,
} from "./tarefa-form-utils";

describe("utilitários do formulário de tarefas", () => {
  it("converte datetime-local para ISO antes de enviar à API", () => {
    const resultado = normalizarDataHoraFormulario("2026-12-31T23:59");

    expect(resultado).toBe(new Date("2026-12-31T23:59").toISOString());
    expect(resultado).toMatch(/Z$/);
    expect(Number.isNaN(new Date(resultado).getTime())).toBe(false);
  });

  it("monta contextos como lista e normaliza o módulo", () => {
    expect(
      montarContextosFormulario({
        modulo: "planejamento",
        quinzenaId: "quinzena-1",
      }),
    ).toEqual([
      {
        modulo: "PLANEJAMENTO",
        quinzenaId: "quinzena-1",
      },
    ]);
  });

  it("não envia contexto vazio", () => {
    expect(
      montarContextosFormulario({ modulo: "planejamento", quinzenaId: "" }),
    ).toEqual([]);
  });
});
