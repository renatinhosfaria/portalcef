import type { CSSProperties } from "react";
import type { PublicMap, PublicSeat } from "@essencia/shared/types";
import type { AssentoSelecionado } from "./assentos-types";

export type Bounds = { minX: number; minY: number; width: number; height: number };

export function calcularBoundsMapa(seats: PublicSeat[]): Bounds {
  if (seats.length === 0) return { minX: 0, minY: 0, width: 1, height: 1 };
  const minX = Math.min(...seats.map((seat) => seat.x));
  const minY = Math.min(...seats.map((seat) => seat.y));
  const maxX = Math.max(...seats.map((seat) => seat.x + Math.max(0, seat.width)));
  const maxY = Math.max(...seats.map((seat) => seat.y + Math.max(0, seat.height)));
  return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function calcularBoundsFileira(seats: PublicSeat[], rowLabel: string): Bounds | null {
  const fileira = seats.filter((seat) => seat.rowLabel === rowLabel);
  return fileira.length ? calcularBoundsMapa(fileira) : null;
}

export function calcularViewBoxMapa(bounds: Bounds): string {
  return `${bounds.minX} ${bounds.minY} ${Math.max(1, bounds.width)} ${Math.max(1, bounds.height)}`;
}

export function estiloAssento(seat: PublicSeat, bounds: Bounds): CSSProperties {
  return {
    position: "absolute",
    left: `${((seat.x - bounds.minX) / bounds.width) * 100}%`,
    top: `${((seat.y - bounds.minY) / bounds.height) * 100}%`,
    width: `${(Math.max(0, seat.width) / bounds.width) * 100}%`,
    height: `${(Math.max(0, seat.height) / bounds.height) * 100}%`,
  };
}

export function serializarSelecaoAssentos(selection: Array<{ seatId: string; ticketTypeId: string }>): string {
  const assentos = selection.map((item) => item.seatId).join(",");
  const ticketTypeIds = selection.map((item) => item.ticketTypeId).join(",");
  return `assentos=${encodeURIComponent(assentos)}&ticketTypeIds=${encodeURIComponent(ticketTypeIds)}`;
}

export type RehidratacaoSelecao = {
  selection: AssentoSelecionado[];
  unavailableSeatIds: string[];
  invalid: boolean;
};

export function reidratarSelecaoAssentos(map: PublicMap, seatIds: string[], ticketTypeIds: string[]): RehidratacaoSelecao {
  const invalidInput = !Array.isArray(seatIds) || !Array.isArray(ticketTypeIds)
    || (seatIds.length === 0 ? ticketTypeIds.length > 0 : ticketTypeIds.length !== 1 && ticketTypeIds.length !== seatIds.length);
  if (!Array.isArray(seatIds) || !Array.isArray(ticketTypeIds)) {
    return { selection: [], unavailableSeatIds: [], invalid: true };
  }

  const seatsById = new Map(map.seats.map((seat) => [seat.id, seat]));
  const selection: AssentoSelecionado[] = [];
  const unavailableSeatIds: string[] = [];
  let invalid = invalidInput;
  const seenSeatIds = new Set<string>();
  for (let index = 0; index < seatIds.length; index += 1) {
    const seatId = seatIds[index];
    if (seenSeatIds.has(seatId)) {
      invalid = true;
      continue;
    }
    seenSeatIds.add(seatId);
    const seat = seatsById.get(seatId);
    if (!seat) {
      invalid = true;
      continue;
    }
    if (seat.state !== "available") {
      unavailableSeatIds.push(seatId);
      continue;
    }
    const ticketTypeId = ticketTypeIds.length === 1 ? ticketTypeIds[0] : ticketTypeIds[index];
    if (ticketTypeId === undefined) {
      invalid = true;
      continue;
    }
    selection.push({
      seatId,
      ticketTypeId,
      label: `${seat.rowLabel}-${seat.seatNumber}`,
      accessible: seat.accessible,
    });
  }
  return { selection, unavailableSeatIds, invalid };
}
