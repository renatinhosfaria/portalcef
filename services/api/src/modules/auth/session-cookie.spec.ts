import {
  criarOpcoesCookieSessao,
  criarOpcoesLimpezaCookieSessao,
  obterTtlSessaoSegundos,
} from "./session-cookie";

describe("configuração do cookie de sessão", () => {
  it("converte o TTL configurado em segundos", () => {
    expect(obterTtlSessaoSegundos("168")).toBe(168 * 60 * 60);
  });

  it("usa os mesmos atributos para definir e limpar o cookie", () => {
    const opcoes = criarOpcoesCookieSessao(".portalcef.com.br", "168");
    const limpeza = criarOpcoesLimpezaCookieSessao(".portalcef.com.br");

    expect(opcoes).toEqual(
      expect.objectContaining({
        domain: ".portalcef.com.br",
        path: "/",
        maxAge: 168 * 60 * 60,
      }),
    );
    expect(limpeza).toEqual({ path: "/", domain: ".portalcef.com.br" });
  });
});
