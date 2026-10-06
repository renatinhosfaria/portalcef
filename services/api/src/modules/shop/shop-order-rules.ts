import { BadRequestException } from "@nestjs/common";

export const LIMITE_QUANTIDADE_POR_PRODUTO_ALUNO = 2;

type ItemParaValidacao = {
  productId: string;
  studentName: string;
  quantity: number;
};

/**
 * Garante o limite comercial de unidades por produto e aluno.
 * A soma considera variantes diferentes e não diferencia maiúsculas ou espaços.
 */
export function validarLimiteQuantidadePorProdutoAluno(
  items: ItemParaValidacao[],
): void {
  const quantities = new Map<string, ItemParaValidacao>();

  for (const item of items) {
    const normalizedStudentName = item.studentName
      .trim()
      .toLocaleLowerCase("pt-BR");
    const key = `${item.productId}:${normalizedStudentName}`;
    const current = quantities.get(key) ?? {
      productId: item.productId,
      studentName: item.studentName,
      quantity: 0,
    };

    current.quantity += item.quantity;
    quantities.set(key, current);

    if (current.quantity > LIMITE_QUANTIDADE_POR_PRODUTO_ALUNO) {
      throw new BadRequestException({
        code: "QUANTITY_LIMIT_EXCEEDED",
        message:
          "Limite de 2 unidades por produto por aluno atingido.",
        details: {
          limit: LIMITE_QUANTIDADE_POR_PRODUTO_ALUNO,
          productId: current.productId,
          studentName: current.studentName,
          requestedQuantity: current.quantity,
        },
      });
    }
  }
}
