import { describe, expect, it } from "vitest";

import { deveCarregarDadosFormulario } from "./user-form-utils";

describe("dados do formulário de usuário", () => {
  it("não carrega opções enquanto o formulário está fechado", () => {
    expect(deveCarregarDadosFormulario(false)).toBe(false);
  });

  it("carrega opções quando o formulário está aberto", () => {
    expect(deveCarregarDadosFormulario(true)).toBe(true);
  });
});
