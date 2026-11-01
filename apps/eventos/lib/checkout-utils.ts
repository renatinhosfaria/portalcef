export function lerListaQuery(valor?: string): { values: string[]; invalid: boolean } {
  if (!valor) return { values: [], invalid: false };
  try {
    return {
      values: valor.split(",").map((item) => decodeURIComponent(item)).filter(Boolean),
      invalid: false,
    };
  } catch {
    return { values: [], invalid: true };
  }
}

export function normalizarTiposPorAssento(seatIds: string[], ticketTypeIds: string[]): string[] {
  if (seatIds.length === 0) {
    if (ticketTypeIds.length === 0) return [];
    throw new Error(`A quantidade de tipos de ingresso (${ticketTypeIds.length}) não corresponde aos assentos selecionados (0).`);
  }
  if (ticketTypeIds.length === seatIds.length) return ticketTypeIds;
  if (ticketTypeIds.length === 1 && ticketTypeIds[0]) return seatIds.map(() => ticketTypeIds[0]);
  throw new Error(`A quantidade de tipos de ingresso (${ticketTypeIds.length}) não corresponde aos assentos selecionados (${seatIds.length}).`);
}

export function montarHrefRetornoMapa({
  slug,
  sessionId,
  seatIds,
  ticketTypeIds,
  motivo,
}: {
  slug: string;
  sessionId: string;
  seatIds: string[];
  ticketTypeIds: string[];
  motivo?: "disponibilidade";
}): string {
  const params = new URLSearchParams();
  params.set("assentos", seatIds.join(","));
  params.set("ticketTypeIds", ticketTypeIds.join(","));
  if (motivo) params.set("conflito", motivo);
  return `/evento/${encodeURIComponent(slug)}/sessao/${encodeURIComponent(sessionId)}?${params.toString()}`;
}
