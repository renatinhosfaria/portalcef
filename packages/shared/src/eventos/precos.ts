export type TipoPrecoOferta = "PERCENTUAL" | "VALOR_FIXO";

export type OfertaPreco = {
  id: string;
  version: number;
  name: string;
  pricingType: TipoPrecoOferta;
  minQuantity: number;
  maxQuantity: number | null;
  priceCents: number | null;
  discountPercent: number | null;
  active: boolean;
};

export type ItemPreco = {
  seatId: string;
  ticketTypeId: string;
  participantIndex: number;
  basePriceCents: number;
};

export type OfertaPrecoResumo = {
  id: string;
  version: number;
  name: string;
  minQuantity: number;
  maxQuantity: number | null;
  discountPercent: number | null;
};

export type ResultadoPrecoPedido = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  appliedOffer: OfertaPrecoResumo | null;
  items: Array<ItemPreco & {
    baseUnitPriceCents: number;
    allocatedDiscountCents: number;
    unitPriceCents: number;
    totalPriceCents: number;
  }>;
};

const resumirOferta = (oferta: OfertaPreco): OfertaPrecoResumo => ({
  id: oferta.id,
  version: oferta.version,
  name: oferta.name,
  minQuantity: oferta.minQuantity,
  maxQuantity: oferta.maxQuantity,
  discountPercent: oferta.discountPercent,
});

export function calcularPrecoPedido(input: {
  items: ItemPreco[];
  offers: OfertaPreco[];
  minimumTotalCents?: number;
}): ResultadoPrecoPedido {
  const subtotalCents = input.items.reduce((total, item) => total + item.basePriceCents, 0);
  const quantidade = input.items.length;
  const oferta = input.offers.find(
    (candidate) =>
      candidate.active &&
      quantidade >= candidate.minQuantity &&
      (candidate.maxQuantity === null || quantidade <= candidate.maxQuantity),
  );

  let discountCents = 0;
  let ofertaImpedidaPeloMinimo = false;
  if (oferta) {
    discountCents =
      oferta.pricingType === "PERCENTUAL"
        ? Math.floor((subtotalCents * (oferta.discountPercent ?? 0) + 50) / 100)
        : Math.max(0, subtotalCents - (oferta.priceCents ?? subtotalCents));
    const totalComOferta = subtotalCents - discountCents;
    if (input.minimumTotalCents !== undefined && totalComOferta < input.minimumTotalCents) {
      discountCents = 0;
      ofertaImpedidaPeloMinimo = true;
    }
  }

  const alocacoes = input.items.map(() => 0);
  if (discountCents > 0 && subtotalCents > 0) {
    const partes = input.items.map((item, index) => {
      const numerador = discountCents * item.basePriceCents;
      return { index, inteiro: Math.floor(numerador / subtotalCents), resto: numerador % subtotalCents };
    });
    let restantes = discountCents - partes.reduce((total, parte) => total + parte.inteiro, 0);
    partes.forEach((parte) => { alocacoes[parte.index] = parte.inteiro; });
    partes
      .slice()
      .sort((a, b) => {
        if (b.resto !== a.resto) return b.resto - a.resto;
        const itemA = input.items[a.index]!;
        const itemB = input.items[b.index]!;
        if (itemA.participantIndex !== itemB.participantIndex) return itemA.participantIndex - itemB.participantIndex;
        return itemA.seatId.localeCompare(itemB.seatId);
      })
      .forEach((parte) => {
        if (restantes > 0) {
          alocacoes[parte.index] = (alocacoes[parte.index] ?? 0) + 1;
          restantes -= 1;
        }
      });
  }

  const items = input.items.map((item, index) => {
    const allocatedDiscountCents = alocacoes[index] ?? 0;
    const unitPriceCents = Math.max(0, item.basePriceCents - allocatedDiscountCents);
    return { ...item, baseUnitPriceCents: item.basePriceCents, allocatedDiscountCents, unitPriceCents, totalPriceCents: unitPriceCents };
  });
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents, appliedOffer: oferta && !ofertaImpedidaPeloMinimo ? resumirOferta(oferta) : null, items };
}
