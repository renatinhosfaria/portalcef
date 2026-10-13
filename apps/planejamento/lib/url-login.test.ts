import { describe, expect, it } from "vitest";

import { montarUrlLogin } from "./url-login";

describe("montarUrlLogin", () => {
  it("aponta para /login com o caminho de volta codificado", () => {
    expect(
      montarUrlLogin(
        "/planejamento/plano-aula/periodo-1?turmaId=turma-1",
        "www.portalcef.com.br",
      ),
    ).toBe(
      "/login?returnTo=%2Fplanejamento%2Fplano-aula%2Fperiodo-1%3FturmaId%3Dturma-1",
    );
  });

  it("aponta para o app de login local em desenvolvimento", () => {
    expect(montarUrlLogin("/planejamento", "localhost")).toBe(
      "http://localhost:3003?returnTo=%2Fplanejamento",
    );
  });
});
