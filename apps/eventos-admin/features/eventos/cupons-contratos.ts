import type { AtualizarCupomInput } from "@essencia/shared/schemas";

export type CupomTipo = "PERCENTUAL" | "VALOR_FIXO";
export type CupomValue = {
  id?: string; version?: number; code: string; name: string | null; pricingType: CupomTipo;
  discountPercent: number | null; discountCents: number | null; startsAt: string | null; endsAt: string | null;
  usageLimit: number | null; usageLimitPerBuyer: number | null; active: boolean; confirmedUses?: number;
};

export const cupomInicial: CupomValue = { code: "", name: "", pricingType: "PERCENTUAL", discountPercent: 10, discountCents: null, startsAt: null, endsAt: null, usageLimit: null, usageLimitPerBuyer: null, active: true, confirmedUses: 0 };
export function normalizarDataCupom(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function construirPayloadCupom(value: CupomValue): AtualizarCupomInput {
  return {
    ...(value.id ? { id: value.id } : {}), ...(value.id && value.version !== undefined ? { version: value.version } : {}),
    code: value.code.trim().toUpperCase(), name: value.name?.trim() || null, pricingType: value.pricingType,
    discountPercent: value.pricingType === "PERCENTUAL" ? Math.round(Number(value.discountPercent ?? 0)) : null,
    discountCents: value.pricingType === "VALOR_FIXO" ? Math.round(Number(value.discountCents ?? 0)) : null,
    startsAt: value.startsAt ? new Date(value.startsAt) : null, endsAt: value.endsAt ? new Date(value.endsAt) : null,
    usageLimit: value.usageLimit == null || value.usageLimit === 0 ? null : Math.round(Number(value.usageLimit)),
    usageLimitPerBuyer: value.usageLimitPerBuyer == null || value.usageLimitPerBuyer === 0 ? null : Math.round(Number(value.usageLimitPerBuyer)),
    active: value.active,
  };
}

function cupomValido(value: CupomValue) {
  const code = value.code.trim().length > 0;
  const percent = value.pricingType !== "PERCENTUAL" || (Number.isInteger(value.discountPercent) && value.discountPercent! >= 1 && value.discountPercent! <= 100);
  const fixed = value.pricingType !== "VALOR_FIXO" || (Number.isInteger(value.discountCents) && value.discountCents! >= 0);
  const dates = !value.startsAt || !value.endsAt || new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime();
  const limits = (value.usageLimit == null || (Number.isInteger(value.usageLimit) && value.usageLimit > 0)) && (value.usageLimitPerBuyer == null || (Number.isInteger(value.usageLimitPerBuyer) && value.usageLimitPerBuyer > 0));
  return code && percent && fixed && dates && limits;
}
export function cupomProntoParaSalvar(value: CupomValue | CupomValue[]) { const values = Array.isArray(value) ? value : [value]; return values.length > 0 && values.every(cupomValido); }
export function codigosCupomDuplicados(values: CupomValue[]): string[] { const counts = new Map<string, number>(); values.forEach((item) => { const code = item.code.trim().toUpperCase(); if (code) counts.set(code, (counts.get(code) ?? 0) + 1); }); return [...counts.entries()].filter(([, count]) => count > 1).map(([code]) => code); }
