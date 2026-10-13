import { ServerFetchError } from "@essencia/shared/fetchers/server";

/** A API responde 401 quando a sessão do usuário venceu ou não existe. */
export function ehSessaoExpirada(erro: unknown): boolean {
  return erro instanceof ServerFetchError && erro.status === 401;
}
