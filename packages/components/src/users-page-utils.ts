export function criarUrlUsuarios(urlAtual: string, incluirInativos: boolean) {
  const url = new URL(urlAtual, "http://localhost");

  if (incluirInativos) {
    url.searchParams.set("inativos", "true");
  } else {
    url.searchParams.delete("inativos");
  }

  return `${url.pathname}${url.search}`;
}
