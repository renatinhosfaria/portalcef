import { calcularPrecoPedido, type OfertaPreco, type ResultadoPrecoPedido } from "@essencia/shared/eventos/precos";
import type { OfertaPrecoPublica, PublicEventTicketType, PublicMap } from "@essencia/shared/types";
import type { AssentoSelecionado } from "../components/assentos-types";

export type { AssentoSelecionado } from "../components/assentos-types";

export type RehidratacaoSelecao = {
  selection: AssentoSelecionado[];
  unavailableSeatIds: string[];
  invalid: boolean;
};

export function serializarSelecaoAssentos(selection: Array<{ seatId: string; ticketTypeId: string }>): string {
  return `assentos=${encodeURIComponent(selection.map((item) => item.seatId).join(","))}&ticketTypeIds=${encodeURIComponent(selection.map((item) => item.ticketTypeId).join(","))}`;
}

export function reidratarSelecaoAssentos(map: PublicMap, seatIds: string[], ticketTypeIds: string[]): RehidratacaoSelecao {
  const arraysValidos = Array.isArray(seatIds) && Array.isArray(ticketTypeIds);
  const invalidInput = !arraysValidos || (seatIds.length === 0 ? ticketTypeIds.length > 0 : ticketTypeIds.length !== 1 && ticketTypeIds.length !== seatIds.length);
  if (!arraysValidos) return { selection: [], unavailableSeatIds: [], invalid: true };
  const seatsById = new Map(map.seats.map((seat) => [seat.id, seat]));
  const selection: AssentoSelecionado[] = [];
  const unavailableSeatIds: string[] = [];
  let invalid = invalidInput;
  const seenSeatIds = new Set<string>();
  seatIds.forEach((seatId, index) => {
    if (seenSeatIds.has(seatId)) { invalid = true; return; }
    seenSeatIds.add(seatId);
    const seat = seatsById.get(seatId);
    if (!seat) { invalid = true; return; }
    if (seat.state !== "available") { unavailableSeatIds.push(seatId); return; }
    const ticketTypeId = ticketTypeIds.length === 1 ? ticketTypeIds[0] : ticketTypeIds[index];
    if (ticketTypeId === undefined) { invalid = true; return; }
    selection.push({ seatId, ticketTypeId, label: `${seat.rowLabel}${seat.seatNumber}`, accessible: seat.accessible });
  });
  return { selection, unavailableSeatIds, invalid };
}

function ofertasParaCalculo(offers: OfertaPrecoPublica[]): OfertaPreco[] {
  return offers.map((offer) => ({ ...offer, pricingType: "PERCENTUAL" as const, priceCents: null, active: true }));
}

export function calcularPrecoSelecao(selection: AssentoSelecionado[], ticketTypes: PublicEventTicketType[], offers: OfertaPrecoPublica[] = []): ResultadoPrecoPedido {
  const precos = new Map(ticketTypes.map((type) => [type.id, type.priceCents]));
  return calcularPrecoPedido({
    items: selection.map((seat, participantIndex) => ({ seatId: seat.seatId, ticketTypeId: seat.ticketTypeId, participantIndex, basePriceCents: precos.get(seat.ticketTypeId) ?? 0 })),
    offers: ofertasParaCalculo(offers),
  });
}

export function calcularTotalSelecao(selection: AssentoSelecionado[], ticketTypes: PublicEventTicketType[]): number {
  return calcularPrecoSelecao(selection, ticketTypes).subtotalCents;
}
