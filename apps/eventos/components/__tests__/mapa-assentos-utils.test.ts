import { describe, expect, it } from "vitest";
import type { PublicMap, PublicSeat } from "@essencia/shared/types";
import {
  calcularBoundsFileira,
  calcularViewBoxMapa,
  reidratarSelecaoAssentos,
  serializarSelecaoAssentos,
} from "../mapa-assentos-utils";

const seats: PublicSeat[] = [
  { id: "s-1", sessionId: "sessao", rowLabel: "A", seatNumber: "1", x: 10, y: 20, width: 20, height: 10, category: "plateia", accessible: true, state: "available" },
  { id: "s-2", sessionId: "sessao", rowLabel: "A", seatNumber: "2", x: 40, y: 20, width: 20, height: 10, category: null, accessible: false, state: "available" },
  { id: "s-3", sessionId: "sessao", rowLabel: "B", seatNumber: "1", x: 5, y: 50, width: 10, height: 10, category: null, accessible: false, state: "reserved" },
];
const map: PublicMap = { sessionId: "sessao", mapId: "mapa", seats };

describe("utilidades do mapa de assentos", () => {
  it("serializa viewBox com limites normais e mínimos", () => {
    expect(calcularViewBoxMapa({ minX: 10, minY: 20, width: 60, height: 40 })).toBe("10 20 60 40");
    expect(calcularViewBoxMapa({ minX: 0, minY: 0, width: 1, height: 1 })).toBe("0 0 1 1");
  });

  it("calcula bounds da fileira existente e retorna nulo para fileira ausente", () => {
    expect(calcularBoundsFileira(seats, "A")).toEqual({ minX: 10, minY: 20, width: 50, height: 10 });
    expect(calcularBoundsFileira(seats, "C")).toBeNull();
  });

  it("reidrata assentos disponíveis preservando rótulo, acessibilidade e ordem", () => {
    expect(reidratarSelecaoAssentos(map, ["s-2", "s-1"], ["meia", "inteira"])).toEqual({
      selection: [
        { seatId: "s-2", ticketTypeId: "meia", label: "A-2", accessible: false },
        { seatId: "s-1", ticketTypeId: "inteira", label: "A-1", accessible: true },
      ],
      unavailableSeatIds: [],
      invalid: false,
    });
  });

  it("aplica um único tipo a todos os assentos", () => {
    expect(reidratarSelecaoAssentos(map, ["s-1", "s-2"], ["inteira"]).selection.map((seat) => seat.ticketTypeId)).toEqual(["inteira", "inteira"]);
  });

  it("separa assentos indisponíveis e não os inclui na seleção", () => {
    expect(reidratarSelecaoAssentos(map, ["s-1", "s-3"], ["inteira", "inteira"])).toEqual({
      selection: [{ seatId: "s-1", ticketTypeId: "inteira", label: "A-1", accessible: true }],
      unavailableSeatIds: ["s-3"],
      invalid: false,
    });
  });

  it("marca IDs inexistentes ou tipos desalinhados como inválidos sem lançar", () => {
    expect(reidratarSelecaoAssentos(map, ["s-1", "inexistente"], ["inteira", "meia"]).invalid).toBe(true);
    expect(reidratarSelecaoAssentos(map, ["s-1", "s-2"], []).invalid).toBe(true);
  });

  it("mantém a ordem ao serializar a seleção", () => {
    expect(serializarSelecaoAssentos([
      { seatId: "s-2", ticketTypeId: "meia" },
      { seatId: "s-1", ticketTypeId: "inteira" },
    ])).toBe("assentos=s-2%2Cs-1&ticketTypeIds=meia%2Cinteira");
  });
});
