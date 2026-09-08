import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";

import {
  CODIGO_MOTIVO_EXCLUSAO_INVALIDO,
  MENSAGEM_MOTIVO_EXCLUSAO_INVALIDO,
} from "../documento-exclusao";
import { ExcluirDocumentoDto } from "../dto/excluir-documento.dto";
import { criarValidationPipe } from "./validation.pipe";

class OutroDto {
  @IsString()
  @IsNotEmpty()
  campo!: string;
}

function executarValidacao(
  pipe: ReturnType<typeof criarValidationPipe>,
  metatype: new () => unknown,
  payload: unknown,
) {
  return pipe.transform(payload, {
    type: "body",
    metatype,
  });
}

async function capturarErro(operacao: () => Promise<unknown>) {
  try {
    await operacao();
    throw new Error("A validação deveria ter falhado.");
  } catch (erro) {
    return erro;
  }
}

describe("criarValidationPipe", () => {
  it.each([
    ["motivo ausente", {}],
    ["motivo vazio", { motivo: "" }],
    ["motivo com apenas espaços", { motivo: "          " }],
    ["motivo menor que 10 caracteres após o trim", { motivo: " 123456789 " }],
  ])(
    "retorna código e mensagem amigável para %s",
    async (_descricao, payload) => {
      const erro = await capturarErro(() =>
        executarValidacao(criarValidationPipe(), ExcluirDocumentoDto, payload),
      );

      expect(erro).toBeInstanceOf(BadRequestException);
      expect((erro as BadRequestException).getStatus()).toBe(400);
      expect((erro as BadRequestException).getResponse()).toEqual({
        code: CODIGO_MOTIVO_EXCLUSAO_INVALIDO,
        message: MENSAGEM_MOTIVO_EXCLUSAO_INVALIDO,
      });
    },
  );

  it("aceita motivo com exatamente 10 caracteres", async () => {
    await expect(
      executarValidacao(criarValidationPipe(), ExcluirDocumentoDto, {
        motivo: "1234567890",
      }),
    ).resolves.toEqual(expect.objectContaining({ motivo: "1234567890" }));
  });

  it("mantém a resposta padrão para outro DTO inválido", async () => {
    const erro = await capturarErro(() =>
      executarValidacao(criarValidationPipe(), OutroDto, {}),
    );
    const erroPadrao = await capturarErro(() =>
      executarValidacao(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
        }),
        OutroDto,
        {},
      ),
    );

    expect(erro).toBeInstanceOf(BadRequestException);
    expect((erro as BadRequestException).getResponse()).toEqual(
      (erroPadrao as BadRequestException).getResponse(),
    );
    expect((erro as BadRequestException).getResponse()).not.toEqual(
      expect.objectContaining({ code: CODIGO_MOTIVO_EXCLUSAO_INVALIDO }),
    );
  });
});
