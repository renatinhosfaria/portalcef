export interface ContextoFormulario {
  modulo: string;
  quinzenaId: string;
}

export function normalizarDataHoraFormulario(valor: string): string {
  if (!valor) return valor;

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;

  return data.toISOString();
}

export function montarContextosFormulario(
  contexto: ContextoFormulario,
): Array<{ modulo: string; quinzenaId?: string }> {
  if (!contexto.quinzenaId.trim()) return [];

  return [
    {
      modulo: contexto.modulo.toUpperCase(),
      quinzenaId: contexto.quinzenaId.trim(),
    },
  ];
}
