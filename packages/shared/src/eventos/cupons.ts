export type TipoPrecoCupom = "PERCENTUAL" | "VALOR_FIXO";

export type CupomPreco = {
  id: string;
  version: number;
  code: string;
  name?: string | null;
  pricingType: TipoPrecoCupom;
  discountPercent: number | null;
  discountCents: number | null;
  active: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  usageLimit?: number | null;
  usageLimitPerBuyer?: number | null;
};

export type CupomAdmin = CupomPreco & { confirmedUses: number; };

export type CupomAplicado = Pick<CupomPreco, "id" | "version" | "code" | "name" | "pricingType" | "discountPercent" | "discountCents">;

export function normalizarCodigoCupom(codigo: string): string {
  return codigo.trim().toUpperCase();
}

export function identidadeCupomDoComprador(input: { email: string; phone: string }): { email: string; phone: string } {
  return { email: input.email.trim().toLowerCase(), phone: input.phone.replace(/\D/g, "") };
}
