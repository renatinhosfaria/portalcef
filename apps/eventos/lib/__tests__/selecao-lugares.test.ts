import { describe, expect, it } from "vitest";
import type { OfertaPrecoPublica, PublicEventTicketType, PublicMap, PublicSeat } from "@essencia/shared/types";
import { calcularPrecoSelecao, reidratarSelecaoAssentos, serializarSelecaoAssentos } from "../selecao-lugares";

const seats: PublicSeat[] = Array.from({ length: 3 }, (_, index) => ({
  id: `s-${index + 1}`, sessionId: "sessao", rowLabel: "G", seatNumber: String(index + 19), x: index * 10, y: 0, width: 8, height: 8,
  category: "COMUM", accessible: false, state: index === 2 ? "sold" as const : "available" as const,
}));
const map: PublicMap = { sessionId: "sessao", mapId: "mapa", seats };
const inteira: PublicEventTicketType = { id: "inteira", name: "Inteira", description: null, priceCents: 4500, maxPerOrder: null, eligibility: null };
const oferta: OfertaPrecoPublica = { id: "oferta", version: 1, name: "Grupo", minQuantity: 10, maxQuantity: null, discountPercent: 15 };

describe("seleção de lugares", () => {
  it("reidrata e serializa seleção preservando ordem e conflitos", () => {
    expect(reidratarSelecaoAssentos(map, ["s-2", "s-3"], ["inteira", "inteira"])).toEqual({
      selection: [{ seatId: "s-2", ticketTypeId: "inteira", label: "G20", accessible: false }], unavailableSeatIds: ["s-3"], invalid: false,
    });
    expect(serializarSelecaoAssentos([{ seatId: "s-2", ticketTypeId: "inteira" }, { seatId: "s-1", ticketTypeId: "meia" }])).toBe("assentos=s-2%2Cs-1&ticketTypeIds=inteira%2Cmeia");
  });

  it("aplica oferta de 15% para 10 lugares e mantém 9 sem desconto", () => {
    const nove = Array.from({ length: 9 }, (_, i) => ({ seatId: `s-${i}`, ticketTypeId: "inteira" }));
    const dez = [...nove, { seatId: "s-9", ticketTypeId: "inteira" }];
    expect(calcularPrecoSelecao(nove, [inteira], [oferta])).toMatchObject({ subtotalCents: 40500, discountCents: 0, totalCents: 40500 });
    expect(calcularPrecoSelecao(dez, [inteira], [oferta])).toMatchObject({ subtotalCents: 45000, discountCents: 6750, totalCents: 38250 });
  });

  it("não aplica oferta fora da quantidade máxima", () => {
    const limitada = { ...oferta, maxQuantity: 10 };
    const vinte = Array.from({ length: 20 }, (_, i) => ({ seatId: `s-${i}`, ticketTypeId: "inteira" }));
    expect(calcularPrecoSelecao(vinte, [inteira], [limitada])).toMatchObject({ subtotalCents: 90000, discountCents: 0, totalCents: 90000, appliedOffer: null });
  });
});
