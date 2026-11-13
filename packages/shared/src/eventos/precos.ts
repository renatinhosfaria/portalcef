import type { CupomAplicado, CupomPreco } from "./cupons";

export type TipoPrecoOferta = "PERCENTUAL" | "VALOR_FIXO";
export type OfertaPreco = { id: string; version: number; name: string; pricingType: TipoPrecoOferta; minQuantity: number; maxQuantity: number | null; priceCents: number | null; discountPercent: number | null; active: boolean; };
export type ItemPreco = { seatId: string; ticketTypeId: string; participantIndex: number; basePriceCents: number; };
export type OfertaPrecoResumo = { id: string; version: number; name: string; minQuantity: number; maxQuantity: number | null; discountPercent: number | null; };
export type ResultadoPrecoPedido = {
  subtotalCents: number; offerDiscountCents: number; couponDiscountCents: number; discountCents: number; totalCents: number;
  appliedOffer: OfertaPrecoResumo | null; appliedCoupon: CupomAplicado | null;
  items: Array<ItemPreco & { baseUnitPriceCents: number; allocatedDiscountCents: number; allocatedOfferDiscountCents: number; allocatedCouponDiscountCents: number; unitPriceCents: number; totalPriceCents: number; }>;
};
const resumirOferta = (oferta: OfertaPreco): OfertaPrecoResumo => ({ id: oferta.id, version: oferta.version, name: oferta.name, minQuantity: oferta.minQuantity, maxQuantity: oferta.maxQuantity, discountPercent: oferta.discountPercent });
const resumirCupom = (cupom: CupomPreco): CupomAplicado => ({ id: cupom.id, version: cupom.version, code: cupom.code, name: cupom.name, pricingType: cupom.pricingType, discountPercent: cupom.discountPercent, discountCents: cupom.discountCents });

function ratear(desconto: number, valores: number[], items: ItemPreco[]): number[] {
  const total = valores.reduce((sum, value) => sum + value, 0);
  const alocacoes = valores.map(() => 0);
  if (desconto <= 0 || total <= 0) return alocacoes;
  const partes = valores.map((valor, index) => { const numerador = desconto * valor; return { index, inteiro: Math.floor(numerador / total), resto: numerador % total }; });
  let restantes = desconto - partes.reduce((sum, parte) => sum + parte.inteiro, 0);
  partes.forEach((parte) => { alocacoes[parte.index] = parte.inteiro; });
  partes.filter((parte) => valores[parte.index]! > 0).slice().sort((a, b) => { if (b.resto !== a.resto) return b.resto - a.resto; const itemA = items[a.index]!; const itemB = items[b.index]!; if (itemA.participantIndex !== itemB.participantIndex) return itemA.participantIndex - itemB.participantIndex; return itemA.seatId.localeCompare(itemB.seatId); }).forEach((parte) => { if (restantes > 0 && (alocacoes[parte.index] ?? 0) < valores[parte.index]!) { alocacoes[parte.index] = (alocacoes[parte.index] ?? 0) + 1; restantes -= 1; } });
  return alocacoes;
}

export function calcularPrecoPedido(input: { items: ItemPreco[]; offers: OfertaPreco[]; coupon?: CupomPreco | null; minimumTotalCents?: number }): ResultadoPrecoPedido {
  const subtotalCents = input.items.reduce((total, item) => total + item.basePriceCents, 0);
  const oferta = input.offers.find((candidate) => candidate.active && input.items.length >= candidate.minQuantity && (candidate.maxQuantity === null || input.items.length <= candidate.maxQuantity));
  let offerDiscountCents = 0;
  let ofertaImpedidaPeloMinimo = false;
  if (oferta) {
    offerDiscountCents = oferta.pricingType === "PERCENTUAL" ? Math.floor((subtotalCents * (oferta.discountPercent ?? 0) + 50) / 100) : Math.max(0, subtotalCents - (oferta.priceCents ?? subtotalCents));
    if (input.minimumTotalCents !== undefined && subtotalCents - offerDiscountCents < input.minimumTotalCents) { offerDiscountCents = 0; ofertaImpedidaPeloMinimo = true; }
  }
  const valoresAposOferta = input.items.map((item, index) => Math.max(0, item.basePriceCents - (ratear(offerDiscountCents, input.items.map((i) => i.basePriceCents), input.items)[index] ?? 0)));
  const ofertaAlocacoes = ratear(offerDiscountCents, input.items.map((i) => i.basePriceCents), input.items);
  let couponDiscountCents = 0;
  const coupon = input.coupon?.active ? input.coupon : null;
  if (coupon) couponDiscountCents = coupon.pricingType === "PERCENTUAL" ? Math.min(valoresAposOferta.reduce((a, b) => a + b, 0), Math.floor((valoresAposOferta.reduce((a, b) => a + b, 0) * (coupon.discountPercent ?? 0) + 50) / 100)) : Math.min(valoresAposOferta.reduce((a, b) => a + b, 0), Math.max(0, coupon.discountCents ?? 0));
  const couponAlocacoes = ratear(couponDiscountCents, valoresAposOferta, input.items);
  const discountCents = offerDiscountCents + couponDiscountCents;
  const items = input.items.map((item, index) => { const allocatedOfferDiscountCents = ofertaAlocacoes[index] ?? 0; const allocatedCouponDiscountCents = couponAlocacoes[index] ?? 0; const allocatedDiscountCents = allocatedOfferDiscountCents + allocatedCouponDiscountCents; const unitPriceCents = Math.max(0, item.basePriceCents - allocatedDiscountCents); return { ...item, baseUnitPriceCents: item.basePriceCents, allocatedDiscountCents, allocatedOfferDiscountCents, allocatedCouponDiscountCents, unitPriceCents, totalPriceCents: unitPriceCents }; });
  return { subtotalCents, offerDiscountCents, couponDiscountCents, discountCents, totalCents: Math.max(0, subtotalCents - discountCents), appliedOffer: oferta && !ofertaImpedidaPeloMinimo ? resumirOferta(oferta) : null, appliedCoupon: coupon ? resumirCupom(coupon) : null, items };
}
