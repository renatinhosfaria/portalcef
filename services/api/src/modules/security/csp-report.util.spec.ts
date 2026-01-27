import { extrairResumoRelatorioCsp } from "./csp-report.util";

describe("extrairResumoRelatorioCsp", () => {
  it("extrai campos principais do relatorio", () => {
    const entrada = {
      "csp-report": {
        "document-uri": "https://loja.portalcef.com.br",
        "violated-directive": "img-src",
        "blocked-uri": "https://ui-avatars.com/api/",
      },
    };

    expect(extrairResumoRelatorioCsp(entrada)).toEqual({
      documentUri: "https://loja.portalcef.com.br",
      violatedDirective: "img-src",
      blockedUri: "https://ui-avatars.com/api/",
    });
  });

  it("retorna null quando body invalido", () => {
    expect(extrairResumoRelatorioCsp(null)).toBeNull();
    expect(extrairResumoRelatorioCsp({})).toBeNull();
  });
});
