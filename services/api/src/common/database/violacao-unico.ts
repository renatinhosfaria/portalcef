const CODIGO_VIOLACAO_UNICO = "23505";

type ErroDoBanco = { code?: unknown; constraint_name?: unknown; constraint?: unknown; cause?: unknown };

/**
 * Identifica violação de índice único (código 23505 do PostgreSQL).
 *
 * O Drizzle 0.45 embrulha todo erro de consulta em `DrizzleQueryError` e guarda
 * o erro do driver em `cause`; o postgres-js chama o campo da restrição de
 * `constraint_name` (o driver `pg` usa `constraint`). Aceita as duas formas.
 *
 * @returns o nome da restrição violada, `""` se o driver não informou o nome,
 * ou `null` quando o erro não é violação de único.
 */
export function violacaoDeUnico(erro: unknown): string | null {
  const candidatos = [erro, (erro as ErroDoBanco | null | undefined)?.cause];
  for (const candidato of candidatos) {
    if (!candidato || typeof candidato !== "object") continue;
    const { code, constraint_name, constraint } = candidato as ErroDoBanco;
    if (code !== CODIGO_VIOLACAO_UNICO) continue;
    if (typeof constraint_name === "string") return constraint_name;
    if (typeof constraint === "string") return constraint;
    return "";
  }
  return null;
}
