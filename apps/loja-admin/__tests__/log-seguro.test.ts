import { describe, it, expect } from "vitest";

import {
  mascararEmail,
  mascararTelefone,
  sanitizarClienteParaLog,
} from "../lib/log-seguro";

describe("log seguro", () => {
  it("mascara email mantendo dominio", () => {
    expect(mascararEmail("joao.silva@exemplo.com")).toBe("***@exemplo.com");
  });

  it("mascara telefone mantendo os ultimos 4 digitos", () => {
    expect(mascararTelefone("34988133623")).toBe("****3623");
  });

  it("sanitiza cliente para log sem PII", () => {
    const cliente = { name: "Joaquim Ferreira", phone: "34988133623", email: "joaquim@exemplo.com" };
    const resultado = sanitizarClienteParaLog(cliente);

    expect(resultado).toEqual({
      name: "REMOVIDO",
      phone: "****3623",
      email: "***@exemplo.com",
    });
  });
});
