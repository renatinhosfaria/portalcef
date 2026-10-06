export interface EstatisticasTarefas {
  total: number;
  pendentes: number;
  concluidas: number;
  canceladas: number;
  atrasadas: number;
  proximasVencer: number;
}

export function normalizarEstatisticasTarefas(
  valores: Partial<EstatisticasTarefas>,
): EstatisticasTarefas {
  return {
    total: valores.total ?? 0,
    pendentes: valores.pendentes ?? 0,
    concluidas: valores.concluidas ?? 0,
    canceladas: valores.canceladas ?? 0,
    atrasadas: valores.atrasadas ?? 0,
    proximasVencer: valores.proximasVencer ?? 0,
  };
}
