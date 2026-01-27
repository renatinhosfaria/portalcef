export function montarUrlPortal(path: string, origem?: string) {
  const origemFinal =
    origem ??
    (typeof window === "undefined"
      ? "https://www.portalcef.com.br"
      : window.location.origin);
  const destino = path.startsWith("/") ? path : `/${path}`;
  return `${origemFinal}${destino}`;
}
