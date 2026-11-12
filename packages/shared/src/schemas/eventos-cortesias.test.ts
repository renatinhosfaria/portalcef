import { describe, expect, it } from "vitest";

import { cancelarCortesiaSchema, emitirCortesiasSchema } from "./eventos";

const UUID_A = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const UUID_B = "8d9e0f1a-2b3c-4d5e-8f6a-7b8c9d0e1f2a";

const gerarAssentos = (quantidade: number) =>
  Array.from({ length: quantidade }, (_, i) => ({
    inventorySeatId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  }));
const cinquenta = gerarAssentos(50);
const cinquentaEUm = gerarAssentos(51);

const base = {
  sessionId: UUID_A,
  chave: "chave-lote-1",
  grupo: "Professores",
  motivo: "Convidados da direção",
  assentos: [{ inventorySeatId: UUID_B }],
};

describe("schemas de cortesia", () => {
  it("aceita o lote mínimo", () => {
    expect(emitirCortesiasSchema.parse(base).assentos).toHaveLength(1);
  });

  it("apara grupo e motivo", () => {
    const resultado = emitirCortesiasSchema.parse({ ...base, grupo: "  Professores  ", motivo: "  Convidados  " });
    expect(resultado.grupo).toBe("Professores");
    expect(resultado.motivo).toBe("Convidados");
  });

  it("trata nome só com espaços como ausente", () => {
    expect(
      emitirCortesiasSchema.parse({ ...base, assentos: [{ inventorySeatId: UUID_B, nome: "   " }] }).assentos[0].nome,
    ).toBeUndefined();
  });

  it("apara o nome informado", () => {
    expect(
      emitirCortesiasSchema.parse({ ...base, assentos: [{ inventorySeatId: UUID_B, nome: " Maria " }] }).assentos[0].nome,
    ).toBe("Maria");
  });

  it("recusa lote vazio e lote com 51", () => {
    expect(emitirCortesiasSchema.safeParse({ ...base, assentos: [] }).success).toBe(false);
    expect(emitirCortesiasSchema.safeParse({ ...base, assentos: cinquentaEUm }).success).toBe(false);
  });

  it("aceita lote com 50", () => {
    expect(emitirCortesiasSchema.safeParse({ ...base, assentos: cinquenta }).success).toBe(true);
  });

  it("recusa assento repetido", () => {
    const resultado = emitirCortesiasSchema.safeParse({
      ...base,
      assentos: [{ inventorySeatId: UUID_B }, { inventorySeatId: UUID_B }],
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.some((i) => i.message === "Assento repetido no lote")).toBe(true);
    }
  });

  it("recusa grupo com 1 caractere e motivo com 2", () => {
    expect(emitirCortesiasSchema.safeParse({ ...base, grupo: "a" }).success).toBe(false);
    expect(emitirCortesiasSchema.safeParse({ ...base, motivo: "ab" }).success).toBe(false);
  });

  it("recusa e-mail inválido e aceita e-mail vazio como ausente", () => {
    expect(emitirCortesiasSchema.safeParse({ ...base, contatoEmail: "x" }).success).toBe(false);
    expect(emitirCortesiasSchema.parse({ ...base, contatoEmail: "" }).contatoEmail).toBeUndefined();
    expect(emitirCortesiasSchema.parse({ ...base, contatoTelefone: "" }).contatoTelefone).toBeUndefined();
  });

  it("recusa chave curta e ids que não são uuid", () => {
    expect(emitirCortesiasSchema.safeParse({ ...base, chave: "curta" }).success).toBe(false);
    expect(emitirCortesiasSchema.safeParse({ ...base, sessionId: "x" }).success).toBe(false);
    expect(emitirCortesiasSchema.safeParse({ ...base, assentos: [{ inventorySeatId: "x" }] }).success).toBe(false);
  });

  it("cancelamento exige motivo de 3 a 500 após aparar", () => {
    expect(cancelarCortesiaSchema.safeParse({ motivo: "  a " }).success).toBe(false);
    expect(cancelarCortesiaSchema.parse({ motivo: " erro de digitação " }).motivo).toBe("erro de digitação");
  });
});
