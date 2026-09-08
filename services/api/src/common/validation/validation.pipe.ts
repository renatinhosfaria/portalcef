import { ValidationPipe } from "@nestjs/common";
import type { ValidationError } from "class-validator";

import { criarErroMotivoExclusaoInvalido } from "../documento-exclusao";
import { ExcluirDocumentoDto } from "../dto/excluir-documento.dto";

const OPCOES_VALIDACAO = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
} as const;

function ehErroDeMotivoDeExclusao(errors: ValidationError[]): boolean {
  return errors.some(
    (error) =>
      error.target instanceof ExcluirDocumentoDto &&
      error.property === "motivo",
  );
}

export function criarValidationPipe(): ValidationPipe {
  const exceptionFactoryPadrao = new ValidationPipe(
    OPCOES_VALIDACAO,
  ).createExceptionFactory();

  return new ValidationPipe({
    ...OPCOES_VALIDACAO,
    exceptionFactory: (errors) => {
      if (ehErroDeMotivoDeExclusao(errors)) {
        return criarErroMotivoExclusaoInvalido();
      }

      return exceptionFactoryPadrao(errors);
    },
  });
}
