import { describe, expect, it } from "vitest";

import {
  LOGIN_ENDPOINT,
  analisarRespostaLogin,
  destinoAposLogin,
  prepararDadosLogin,
} from "./login-flow";

describe("fluxo de login", () => {
  it("preserva a grafia do e-mail cadastrado e o conteúdo da senha", () => {
    expect(prepararDadosLogin(" Ana@exemplo.com ", " senha123 ")).toEqual({
      email: "Ana@exemplo.com",
      password: " senha123 ",
    });
  });
  it("usa o proxy do próprio app quando está atrás do basePath /login", () => {
    expect(LOGIN_ENDPOINT).toBe("/login/api/auth/login");
  });

  it("rejeita resposta que não seja JSON utilizável", async () => {
    const resposta = new Response("<html>indisponível</html>", {
      status: 502,
      headers: { "content-type": "text/html" },
    });

    await expect(analisarRespostaLogin(resposta)).rejects.toThrow(
      "Não foi possível concluir o login",
    );
  });

  it("aceita uma resposta de login bem-sucedida", async () => {
    const resposta = new Response(
      JSON.stringify({
        success: true,
        data: {
          user: {
            id: "u-1",
            email: "ana@example.com",
            name: "Ana",
            role: "professora",
            schoolId: null,
            unitId: null,
            stageId: null,
          },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

    await expect(analisarRespostaLogin(resposta)).resolves.toMatchObject({
      success: true,
      data: { user: { id: "u-1" } },
    });
  });

  it("mantém um destino interno solicitado após o login", () => {
    expect(destinoAposLogin("?returnTo=%2Fplanejamento%3Fano%3D2026")).toBe(
      "/planejamento?ano=2026",
    );
  });

  it("ignora destinos externos e usa a home", () => {
    expect(destinoAposLogin("?returnTo=https%3A%2F%2Fexemplo.com")).toBe("/");
    expect(destinoAposLogin("?returnTo=%2F%2Fexemplo.com")).toBe("/");
  });

  it("envia o login local para a porta da home", () => {
    expect(destinoAposLogin("", "http://localhost:3003")).toBe(
      "http://localhost:3000/",
    );
    expect(destinoAposLogin("", "http://127.0.0.1:3003")).toBe(
      "http://127.0.0.1:3000/",
    );
  });

  it("mantém o destino relativo quando há um proxy na mesma origem", () => {
    expect(destinoAposLogin("", "https://www.portalcef.com.br")).toBe("/");
  });
});
