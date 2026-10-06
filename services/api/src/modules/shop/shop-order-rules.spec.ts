import { BadRequestException } from "@nestjs/common";
import { validarLimiteQuantidadePorProdutoAluno } from "./shop-order-rules";

describe("regras de quantidade da loja", () => {
  it("rejeita mais de duas unidades do mesmo produto para o mesmo aluno entre variantes", () => {
    expect(() =>
      validarLimiteQuantidadePorProdutoAluno([
        { productId: "produto-1", studentName: " Ana Silva ", quantity: 1 },
        { productId: "produto-1", studentName: "ana silva", quantity: 2 },
      ]),
    ).toThrow(BadRequestException);
  });

  it("aceita até duas unidades do mesmo produto para o mesmo aluno", () => {
    expect(() =>
      validarLimiteQuantidadePorProdutoAluno([
        { productId: "produto-1", studentName: "Ana Silva", quantity: 1 },
        { productId: "produto-1", studentName: "ana silva", quantity: 1 },
      ]),
    ).not.toThrow();
  });
});
