import {
  atualizarCategoriaSchema,
  listarExecucoesSchema,
} from "./workflows.dto";

describe("workflows.dto", () => {
  it("rejeita payload vazio ao atualizar categoria", () => {
    expect(atualizarCategoriaSchema.safeParse({}).success).toBe(false);
  });

  it("interpreta query teste false como boolean false", () => {
    expect(listarExecucoesSchema.parse({ teste: "false" }).teste).toBe(false);
  });

  it("interpreta query teste true como boolean true", () => {
    expect(listarExecucoesSchema.parse({ teste: "true" }).teste).toBe(true);
  });
});
