/**
 * Avalia, em memória, os predicados montados com o shim de `@essencia/db`
 * (`and`, `eq`) contra uma linha simples. Operadores desconhecidos não filtram.
 */
export function avaliarPredicado(predicado: any, linha: Record<string, unknown>): boolean {
  if (!predicado || !predicado.name) return true;
  if (predicado.name === "and") return predicado.args.every((item: any) => avaliarPredicado(item, linha));
  if (predicado.name === "eq") {
    const coluna = predicado.args[0];
    // Comparação entre colunas (condição de join) não é avaliada: só valores literais.
    if (!coluna?.__column || predicado.args[1]?.__column) return true;
    return linha[coluna.__column] === predicado.args[1];
  }
  return true;
}
