"use client";

import React, { type ChangeEvent } from "react";
import type { OfertaValue } from "./ofertas-contratos";

type OfertaEditorProps = {
  initialValue: OfertaValue;
  onChange?: (value: OfertaValue) => void;
  disabled?: boolean;
};

function numeroOuNulo(event: ChangeEvent<HTMLInputElement>): number | null {
  return event.target.value === "" ? null : Number(event.target.value);
}

export function OfertaEditor({ initialValue, onChange, disabled = false }: OfertaEditorProps) {
  const resumo = initialValue.pricingType === "PERCENTUAL"
    ? `${initialValue.discountPercent ?? 0}% a partir de ${initialValue.minQuantity || 0} lugares`
    : `Preço fixo a partir de ${initialValue.minQuantity || 0} lugares`;
  const maximo = initialValue.maxQuantity == null ? "sem limite máximo" : `até ${initialValue.maxQuantity} lugares`;
  const atualizar = (patch: Partial<OfertaValue>) => onChange?.({ ...initialValue, ...patch });

  return (
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Configuração de oferta">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Desconto por volume</h3>
          <p className="mt-1 text-sm text-blue-700" role="status">{resumo}</p>
          <p className="text-xs text-slate-500">{maximo}</p>
        </div>
        <span className={`text-sm ${initialValue.active ? "text-emerald-700" : "text-slate-500"}`}>
          {initialValue.active ? "Oferta ativa" : "Oferta arquivada"}
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Nome da oferta
          <input aria-label="Nome da oferta" value={initialValue.name} disabled={disabled} onChange={(event) => atualizar({ name: event.target.value })} className="w-full rounded-lg border border-slate-300 p-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Tipo de oferta
          <select aria-label="Tipo de oferta" value={initialValue.pricingType} disabled={disabled} onChange={(event) => atualizar({ pricingType: event.target.value as OfertaValue["pricingType"] })} className="w-full rounded-lg border border-slate-300 p-2 font-normal">
            <option value="PERCENTUAL">Percentual</option>
            <option value="VALOR_FIXO">Valor fixo legado</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Quantidade mínima
          <input aria-label="Quantidade mínima" type="number" min="1" step="1" value={Number.isNaN(initialValue.minQuantity) ? "" : initialValue.minQuantity} disabled={disabled} onChange={(event) => atualizar({ minQuantity: Number(event.target.value) })} className="w-full rounded-lg border border-slate-300 p-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Quantidade máxima (opcional)
          <input aria-label="Quantidade máxima" type="number" min="1" step="1" value={initialValue.maxQuantity ?? ""} disabled={disabled} onChange={(event) => atualizar({ maxQuantity: numeroOuNulo(event) })} className="w-full rounded-lg border border-slate-300 p-2 font-normal" placeholder="Sem limite" />
        </label>
        {initialValue.pricingType === "PERCENTUAL" ? (
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Percentual de desconto
            <input aria-label="Percentual de desconto" type="number" min="0" max="100" step="1" value={initialValue.discountPercent ?? ""} disabled={disabled} onChange={(event) => atualizar({ discountPercent: numeroOuNulo(event) })} className="w-full rounded-lg border border-slate-300 p-2 font-normal" />
          </label>
        ) : (
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Preço total da faixa (centavos)
            <input aria-label="Preço total da faixa" type="number" min="0" step="1" value={initialValue.priceCents ?? ""} disabled={disabled} onChange={(event) => atualizar({ priceCents: numeroOuNulo(event) })} className="w-full rounded-lg border border-slate-300 p-2 font-normal" />
          </label>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input aria-label="Oferta ativa" type="checkbox" checked={initialValue.active} disabled={disabled} onChange={(event) => atualizar({ active: event.target.checked })} />
        Ativar esta oferta
      </label>
      {initialValue.version ? <p className="text-xs text-slate-500">Versão {initialValue.version}</p> : null}
    </article>
  );
}
