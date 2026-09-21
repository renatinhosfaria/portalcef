import { getSegmentosPermitidos, isGestao } from "./plano-aula.dto";

describe("plano-aula.dto", () => {
  it("considera gerente_financeiro como gestão para visualização gerencial", () => {
    expect(isGestao("gerente_financeiro")).toBe(true);
  });

  it.each([
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
  ])("considera %s como gestão global do planejamento", (role) => {
    expect(isGestao(role)).toBe(true);
    expect(getSegmentosPermitidos(role)).toBeNull();
  });
});
