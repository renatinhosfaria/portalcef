import { origemPublicaEventos } from "./eventos-api";

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

type RetornoMapa = { slug: string; sessionId: string; motivo?: "disponibilidade" } & ({ seatIds: string[]; ticketTypeIds: string[]; rascunhoId?: never } | { rascunhoId: string; seatIds?: never; ticketTypeIds?: never });

export function montarHrefRetornoMapa(entrada: RetornoMapa): string {
  const params = new URLSearchParams();
  if (entrada.rascunhoId !== undefined) params.set("selecao", entrada.rascunhoId);
  else {
    params.set("assentos", entrada.seatIds.join(","));
    params.set("ticketTypeIds", entrada.ticketTypeIds.join(","));
  }
  if (entrada.motivo) params.set("conflito", entrada.motivo);
  return `/evento/${encodeURIComponent(entrada.slug)}/sessao/${encodeURIComponent(entrada.sessionId)}?${params.toString()}`;
}

export function montarUrlRetornoPagamento(orderNumber: string, acesso: string): string {
  return `${origemPublicaEventos()}/pedido/${encodeURIComponent(orderNumber)}?acesso=${encodeURIComponent(acesso)}`;
}
