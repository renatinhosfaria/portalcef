import type { CSSProperties } from "react";
import type { PublicSeat } from "@essencia/shared/types";

export type Bounds = { minX: number; minY: number; width: number; height: number };

export function calcularBoundsMapa(seats: PublicSeat[]): Bounds {
  if (seats.length === 0) return { minX: 0, minY: 0, width: 1, height: 1 };
  const minX = Math.min(...seats.map((seat) => seat.x));
  const minY = Math.min(...seats.map((seat) => seat.y));
  const maxX = Math.max(...seats.map((seat) => seat.x + Math.max(0, seat.width)));
  const maxY = Math.max(...seats.map((seat) => seat.y + Math.max(0, seat.height)));
  return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
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
