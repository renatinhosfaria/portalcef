import { describe, expect, it } from "vitest";

import {
  obterMensagemErro,
  obterMensagemErroDaRespostaApi,
  obterMensagemErroExclusao,
} from "./mensagens-erro";

describe("mensagens de erro amigáveis", () => {
  it("traduz erro técnico do SharePoint para uma orientação simples", () => {
    const mensagem = obterMensagemErro(
      Object.assign(new Error("The resource could not be found."), {
        code: "itemNotFound",
        statusCode: 404,
      }),
      "Não foi possível abrir o documento.",
    );

    expect(mensagem).toBe(
      "Não conseguimos abrir esse documento agora. Tente abrir novamente em alguns instantes.",
    );
    expect(mensagem).not.toContain("resource");
    expect(mensagem).not.toContain("itemNotFound");
  });

  it("traduz sessão expirada sem mostrar código técnico", () => {
    expect(
      obterMensagemErro(
        {
          status: 401,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        "Não foi possível continuar.",
      ),
    ).toBe("Sua sessão expirou. Faça login novamente para continuar.");
  });

  it("informa falta de permissão de forma clara na exclusão", () => {
    expect(obterMensagemErroExclusao({ response: { status: 403 } })).toBe(
      "Você não tem permissão para excluir este arquivo.",
    );
  });

  it.each([
    [401, "Sua sessão expirou. Faça login novamente para continuar."],
    [429, "Houve muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."],
    [503, "Não conseguimos conectar ao portal agora. Verifique sua internet e tente novamente."],
  ])("preserva mensagem segura de exclusão para status %s", (status, mensagem) => {
    expect(obterMensagemErroExclusao({ status }, "Falha de exclusão.")).toBe(
      mensagem,
    );
  });

  it("preserva uma mensagem segura já traduzida em uma segunda passagem", () => {
    const mensagem =
      "Houve muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";

    expect(obterMensagemErroExclusao(new Error(mensagem))).toBe(mensagem);
  });

  it("extrai mensagem de erro aninhada da resposta da API", () => {
    expect(
      obterMensagemErroDaRespostaApi(
        {
          status: 400,
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Tipo de arquivo não permitido",
          },
        },
        "Não foi possível enviar o arquivo.",
      ),
    ).toBe("Esse arquivo não é aceito. Envie PDF, Word, Excel, PNG ou JPG.");
  });

  it("informa limite máximo de arquivo de 500 MB", () => {
    expect(
      obterMensagemErro(
        { status: 413, error: { code: "FILE_TOO_LARGE" } },
        "Não foi possível enviar o arquivo.",
      ),
    ).toBe("O arquivo é muito grande. Envie um arquivo de até 500 MB.");
  });

  it("preserva mensagem de domínio quando ela já é clara", () => {
    expect(
      obterMensagemErro(
        new Error("Selecione pelo menos um documento antes de enviar."),
        "Não foi possível concluir.",
      ),
    ).toBe("Selecione pelo menos um documento antes de enviar.");
  });

  it.each([
    [
      "MOTIVO_EXCLUSAO_INVALIDO",
      "Informe o motivo da exclusão com pelo menos 10 caracteres.",
    ],
    [
      "DOCUMENTO_APROVADO",
      "Este arquivo já foi aprovado e não pode ser excluído.",
    ],
    [
      "DOCUMENTO_LINK",
      "Links do YouTube não podem ser excluídos por esta opção.",
    ],
    [
      "TIPO_DOCUMENTO_NAO_PERMITIDO",
      "Este item não é um arquivo enviado e não pode ser excluído por esta opção.",
    ],
    [
      "PERMISSAO_EXCLUSAO_DOCUMENTO",
      "Você não tem permissão para excluir este arquivo.",
    ],
    [
      "DOCUMENTO_NAO_ENCONTRADO",
      "Este arquivo não foi encontrado. Atualize a página e tente novamente.",
    ],
    [
      "FALHA_EXCLUSAO_DOCUMENTO",
      "Não foi possível excluir o arquivo agora. Tente novamente. Se o problema continuar, procure o suporte.",
    ],
  ])("converte %s em mensagem clara", (codigo, mensagemEsperada) => {
    expect(
      obterMensagemErro({
        status: 400,
        error: { code: codigo, message: "Mensagem técnica interna" },
      }),
    ).toBe(mensagemEsperada);
  });
});
