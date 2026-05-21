import { isGestao } from "./plano-aula.dto";

describe("plano-aula.dto", () => {
  it("considera gerente_financeiro como gestão para visualização gerencial", () => {
    expect(isGestao("gerente_financeiro")).toBe(true);
  });
});
