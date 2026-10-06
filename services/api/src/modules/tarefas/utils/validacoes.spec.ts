import { validarContextosPorRole } from "./validacoes";

describe("validação de contextos por role", () => {
  it("trata auxiliar de sala como role de execução", () => {
    expect(() =>
      validarContextosPorRole("auxiliar_sala", [
        {
          modulo: "PLANEJAMENTO",
          quinzenaId: "quinzena-1",
        },
      ]),
    ).not.toThrow();
  });
});
