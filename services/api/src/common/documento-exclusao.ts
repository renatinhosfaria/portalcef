import { BadRequestException } from "@nestjs/common";

export const CODIGOS_ERRO_EXCLUSAO_DOCUMENTO = {
  MOTIVO_INVALIDO: "MOTIVO_EXCLUSAO_INVALIDO",
  DOCUMENTO_APROVADO: "DOCUMENTO_APROVADO",
  DOCUMENTO_LINK: "DOCUMENTO_LINK",
  PERMISSAO: "PERMISSAO_EXCLUSAO_DOCUMENTO",
  DOCUMENTO_NAO_ENCONTRADO: "DOCUMENTO_NAO_ENCONTRADO",
  FALHA: "FALHA_EXCLUSAO_DOCUMENTO",
} as const;

export const CODIGO_MOTIVO_EXCLUSAO_INVALIDO =
  CODIGOS_ERRO_EXCLUSAO_DOCUMENTO.MOTIVO_INVALIDO;

export const MENSAGEM_MOTIVO_EXCLUSAO_INVALIDO =
  "Informe o motivo da exclusão com pelo menos 10 caracteres.";

export function criarErroMotivoExclusaoInvalido(): BadRequestException {
  return new BadRequestException({
    code: CODIGO_MOTIVO_EXCLUSAO_INVALIDO,
    message: MENSAGEM_MOTIVO_EXCLUSAO_INVALIDO,
  });
}

export function lancarMotivoExclusaoInvalido(): never {
  throw criarErroMotivoExclusaoInvalido();
}
