"use client";
import type { ChangeEvent } from "react";
import type { CupomValue } from "./cupons-contratos";

type Props = { value: CupomValue; onChange: (value: CupomValue) => void; disabled?: boolean; onDelete?: () => void };
const numberOrNull = (event: ChangeEvent<HTMLInputElement>) => event.target.value === "" ? null : Number(event.target.value);
export function CupomEditor({ value, onChange, disabled = false, onDelete }: Props) {
  const patch = (change: Partial<CupomValue>) => onChange({ ...value, ...change });
  const used = (value.confirmedUses ?? 0) > 0;
  return <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Configuração de cupom">
    <header className="flex items-start justify-between gap-3"><h3 className="text-base font-semibold">Cupom de desconto</h3><span className={value.active ? "text-emerald-700" : "text-slate-500"}>{value.active ? "Cupom ativo" : "Cupom inativo"}</span></header>
    <div className="grid gap-3 md:grid-cols-2">
      <label>Código<input aria-label="Código do cupom" value={value.code} disabled={disabled} onChange={e => patch({ code: e.target.value })} className="w-full rounded border p-2" /></label>
      <label>Nome<input aria-label="Nome do cupom" value={value.name ?? ""} disabled={disabled} onChange={e => patch({ name: e.target.value })} className="w-full rounded border p-2" /></label>
      <label>Tipo<select aria-label="Tipo de cupom" value={value.pricingType} disabled={disabled} onChange={e => patch({ pricingType: e.target.value as CupomValue["pricingType"] })} className="w-full rounded border p-2"><option value="PERCENTUAL">Percentual</option><option value="VALOR_FIXO">Valor fixo</option></select></label>
      {value.pricingType === "PERCENTUAL" ? <label>Percentual de desconto<input aria-label="Percentual de desconto" type="number" min="1" max="100" value={value.discountPercent ?? ""} disabled={disabled} onChange={e => patch({ discountPercent: numberOrNull(e) })} className="w-full rounded border p-2" /></label> : <label>Valor do desconto (centavos)<input aria-label="Valor do desconto" type="number" min="0" value={value.discountCents ?? ""} disabled={disabled} onChange={e => patch({ discountCents: numberOrNull(e) })} className="w-full rounded border p-2" /></label>}
      <label>Início<input aria-label="Início da vigência" type="datetime-local" value={value.startsAt ?? ""} disabled={disabled} onChange={e => patch({ startsAt: e.target.value || null })} className="w-full rounded border p-2" /></label>
      <label>Fim<input aria-label="Fim da vigência" type="datetime-local" value={value.endsAt ?? ""} disabled={disabled} onChange={e => patch({ endsAt: e.target.value || null })} className="w-full rounded border p-2" /></label>
      <label>Limite total<input aria-label="Limite total" type="number" min="1" value={value.usageLimit ?? ""} disabled={disabled} onChange={e => patch({ usageLimit: numberOrNull(e) })} className="w-full rounded border p-2" /></label>
      <label>Limite por comprador<input aria-label="Limite por comprador" type="number" min="1" value={value.usageLimitPerBuyer ?? ""} disabled={disabled} onChange={e => patch({ usageLimitPerBuyer: numberOrNull(e) })} className="w-full rounded border p-2" /></label>
    </div>
    <label className="flex items-center gap-2"><input aria-label="Cupom ativo" type="checkbox" checked={value.active} disabled={disabled} onChange={e => patch({ active: e.target.checked })} /> Ativar cupom</label>
    <p className="text-sm text-slate-500">{value.confirmedUses ?? 0} uso(s) confirmado(s){value.usageLimit ? ` de ${value.usageLimit}` : ""}{value.version ? ` · versão ${value.version}` : ""}</p>
    {onDelete && !used && <button type="button" className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700" disabled={disabled} onClick={onDelete}>Excluir cupom</button>}
  </article>;
}
