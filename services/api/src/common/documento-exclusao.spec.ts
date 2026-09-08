import { BadRequestException } from "@nestjs/common";

import {
  CODIGO_MOTIVO_EXCLUSAO_INVALIDO,
  criarErroMotivoExclusaoInvalido,
  lancarMotivoExclusaoInvalido,
} from "./documento-exclusao";

describe("documento-exclusao", () => {
  it("cria BadRequestException com código técnico de motivo inválido", () => {
    const erro = criarErroMotivoExclusaoInvalido();

    expect(erro).toBeInstanceOf(BadRequestException);
    expect(erro.getResponse()).toEqual({
      code: CODIGO_MOTIVO_EXCLUSAO_INVALIDO,
      message: "Informe o motivo da exclusão com pelo menos 10 caracteres.",
    });
  });

  it("lança BadRequestException com código técnico de motivo inválido", () => {
    expect(() => lancarMotivoExclusaoInvalido()).toThrow(BadRequestException);

    try {
      lancarMotivoExclusaoInvalido();
    } catch (erro) {
      expect((erro as BadRequestException).getResponse()).toEqual({
        code: CODIGO_MOTIVO_EXCLUSAO_INVALIDO,
        message: "Informe o motivo da exclusão com pelo menos 10 caracteres.",
      });
    }
  });
});
