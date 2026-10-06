import { normalizarEstatisticasTarefas } from "./tarefas-stats";

describe("estatísticas de tarefas", () => {
  it("normaliza a linha agregada da API para o contrato compartilhado", () => {
    expect(
      normalizarEstatisticasTarefas({
        total: 4,
        pendentes: 2,
        concluidas: 1,
        canceladas: 1,
        atrasadas: 1,
        proximasVencer: 2,
      }),
    ).toEqual({
      total: 4,
      pendentes: 2,
      concluidas: 1,
      canceladas: 1,
      atrasadas: 1,
      proximasVencer: 2,
    });
  });

  it("preenche contagens ausentes com zero", () => {
    expect(normalizarEstatisticasTarefas({})).toEqual({
      total: 0,
      pendentes: 0,
      concluidas: 0,
      canceladas: 0,
      atrasadas: 0,
      proximasVencer: 0,
    });
  });
});
