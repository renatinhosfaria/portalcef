const TTL_PADRAO_SEGUNDOS = 24 * 60 * 60;

export interface OpcoesCookieSessao {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  domain?: string;
  maxAge: number;
}

export function obterTtlSessaoSegundos(valor: unknown): number {
  const horas = Number(valor);
  if (!Number.isFinite(horas) || horas <= 0) return TTL_PADRAO_SEGUNDOS;
  return Math.floor(horas * 60 * 60);
}

export function criarOpcoesCookieSessao(
  dominio: string | undefined,
  ttlHoras: string | number | undefined,
  seguro = process.env.NODE_ENV === "production",
): OpcoesCookieSessao {
  return {
    httpOnly: true,
    secure: seguro,
    sameSite: "lax",
    path: "/",
    ...(dominio ? { domain: dominio } : {}),
    maxAge: obterTtlSessaoSegundos(ttlHoras),
  };
}

export function criarOpcoesLimpezaCookieSessao(dominio?: string): {
  path: "/";
  domain?: string;
} {
  return {
    path: "/",
    ...(dominio ? { domain: dominio } : {}),
  };
}
