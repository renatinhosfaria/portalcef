import { describe, expect, it } from "vitest";

import {
  obterMensagemErro,
  obterMensagemErroDaRespostaApi,
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
        { status: 401, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        "Não foi possível continuar.",
      ),
    ).toBe("Sua sessão expirou. Faça login novamente para continuar.");
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
    ).toBe(
      "Esse arquivo não é aceito. Envie PDF, Word, Excel, PNG ou JPG.",
    );
  });

  it("preserva mensagem de domínio quando ela já é clara", () => {
    expect(
      obterMensagemErro(
        new Error("Selecione pelo menos um documento antes de enviar."),
        "Não foi possível concluir.",
      ),
    ).toBe("Selecione pelo menos um documento antes de enviar.");
  });
});
