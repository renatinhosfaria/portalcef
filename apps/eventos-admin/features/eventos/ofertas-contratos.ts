import type { AtualizarOfertaInput } from "@essencia/shared/types";

export type OfertaModo = "PERCENTUAL" | "VALOR_FIXO";

export type OfertaValue = {
  id?: string;
  name: string;
  pricingType: OfertaModo;
  minQuantity: number;
  maxQuantity: number | null;
  discountPercent: number | null;
  priceCents: number | null;
  version?: number;
  active: boolean;
};

export const ofertaInicial: OfertaValue = {
  name: "Desconto para grupos",
  pricingType: "PERCENTUAL",
  minQuantity: 10,
  maxQuantity: null,
  discountPercent: 15,
  priceCents: null,
  active: true,
};

export function construirPayloadOferta(value: OfertaValue): AtualizarOfertaInput {
  const payload: AtualizarOfertaInput = {
    ...(value.id ? { id: value.id } : {}),
    ...(value.id && value.version !== undefined ? { version: value.version } : {}),
    name: value.name.trim(),
    pricingType: value.pricingType,
    minQuantity: Math.round(Number(value.minQuantity)),
    maxQuantity: value.maxQuantity == null || value.maxQuantity === 0 ? null : Math.round(Number(value.maxQuantity)),
    discountPercent: value.pricingType === "PERCENTUAL" ? Math.round(Number(value.discountPercent ?? 0)) : null,
    priceCents: value.pricingType === "VALOR_FIXO" ? Math.round(Number(value.priceCents ?? 0)) : null,
    active: value.active,
  };
  return payload;
}

function ofertaValida(value: OfertaValue): boolean {
  const nomeValido = value.name.trim().length > 0;
  const minimoValido = Number.isInteger(value.minQuantity) && value.minQuantity > 0;
  const maximoValido = value.maxQuantity == null || (Number.isInteger(value.maxQuantity) && value.maxQuantity >= value.minQuantity);
  const percentualValido = value.pricingType !== "PERCENTUAL"
    || (value.discountPercent != null && Number.isInteger(value.discountPercent) && value.discountPercent >= 0 && value.discountPercent <= 100);
  const precoValido = value.pricingType !== "VALOR_FIXO"
    || (value.priceCents != null && Number.isInteger(value.priceCents) && value.priceCents >= 0);
  return nomeValido && minimoValido && maximoValido && percentualValido && precoValido;
}

export function ofertaProntaParaSalvar(value: OfertaValue | OfertaValue[]): boolean {
  const values = Array.isArray(value) ? value : [value];
  return values.length > 0 && values.every(ofertaValida) && values.filter((item) => item.active).length <= 1;
}
