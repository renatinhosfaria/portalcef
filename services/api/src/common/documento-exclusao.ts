import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

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
export const MENSAGEM_DOCUMENTO_APROVADO =
  "Este arquivo já foi aprovado e não pode ser excluído.";
export const MENSAGEM_DOCUMENTO_LINK =
  "Links do YouTube não podem ser excluídos por esta opção.";
export const MENSAGEM_PERMISSAO_EXCLUSAO_DOCUMENTO =
  "Você não tem permissão para excluir este arquivo.";
export const MENSAGEM_DOCUMENTO_NAO_ENCONTRADO =
  "Este arquivo não foi encontrado. Atualize a página e tente novamente.";

export function criarErroMotivoExclusaoInvalido(): BadRequestException {
  return new BadRequestException({
    code: CODIGO_MOTIVO_EXCLUSAO_INVALIDO,
    message: MENSAGEM_MOTIVO_EXCLUSAO_INVALIDO,
  });
}

export function lancarMotivoExclusaoInvalido(): never {
  throw criarErroMotivoExclusaoInvalido();
}

export function criarErroDocumentoAprovado(): BadRequestException {
  return new BadRequestException({
    code: CODIGOS_ERRO_EXCLUSAO_DOCUMENTO.DOCUMENTO_APROVADO,
    message: MENSAGEM_DOCUMENTO_APROVADO,
  });
}

export function criarErroDocumentoLink(): BadRequestException {
  return new BadRequestException({
    code: CODIGOS_ERRO_EXCLUSAO_DOCUMENTO.DOCUMENTO_LINK,
    message: MENSAGEM_DOCUMENTO_LINK,
  });
}

export function criarErroPermissaoExclusaoDocumento(): ForbiddenException {
  return new ForbiddenException({
    code: CODIGOS_ERRO_EXCLUSAO_DOCUMENTO.PERMISSAO,
    message: MENSAGEM_PERMISSAO_EXCLUSAO_DOCUMENTO,
  });
}

export function criarErroDocumentoNaoEncontrado(): NotFoundException {
  return new NotFoundException({
    code: CODIGOS_ERRO_EXCLUSAO_DOCUMENTO.DOCUMENTO_NAO_ENCONTRADO,
    message: MENSAGEM_DOCUMENTO_NAO_ENCONTRADO,
  });
}
