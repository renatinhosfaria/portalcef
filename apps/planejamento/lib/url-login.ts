// Mesma convenção de @essencia/shared/fetchers/client: em produção o login fica
// em /login no mesmo domínio (fora do basePath deste app); em desenvolvimento,
// o app de login roda na porta 3003.
export function montarUrlLogin(destino: string, hostname: string): string {
  const urlLogin =
    hostname === "localhost" ? "http://localhost:3003" : "/login";

  return `${urlLogin}?returnTo=${encodeURIComponent(destino)}`;
}

export function irParaLogin(destino: string): void {
  window.location.replace(montarUrlLogin(destino, window.location.hostname));
}
