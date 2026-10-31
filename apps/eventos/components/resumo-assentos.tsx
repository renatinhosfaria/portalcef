"use client";

import React from "react";
import type { PublicEventTicketType } from "@essencia/shared/types";

export type AssentoSelecionado = { seatId: string; ticketTypeId: string; label?: string; accessible?: boolean };

export type ResumoAssentosProps = {
  selection: AssentoSelecionado[];
  ticketTypes: PublicEventTicketType[];
  onChangeTicketType: (seatId: string, ticketTypeId: string) => void;
};

function formatarPreco(precoCents: number) {
  return (precoCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");
}

export function calcularTotalSelecao(selection: AssentoSelecionado[], ticketTypes: PublicEventTicketType[]): number {
  const precos = new Map(ticketTypes.map((type) => [type.id, type.priceCents]));
  return selection.reduce((total, seat) => total + (precos.get(seat.ticketTypeId) ?? 0), 0);
}

export type ResumoAssentosFixoProps = ResumoAssentosProps & { checkoutHref?: string };

export function ResumoAssentosFixo({ selection, ticketTypes, checkoutHref }: ResumoAssentosFixoProps) {
  const total = calcularTotalSelecao(selection, ticketTypes);
  const completo = selection.length > 0 && selection.every((seat) => ticketTypes.some((type) => type.id === seat.ticketTypeId));
  const href = completo ? checkoutHref : undefined;

  return <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:hidden" role="region" aria-label="Resumo fixo da seleção">
    <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">{selection.length ? `${selection.length} assento(s) selecionado(s)` : "Nenhum assento selecionado"}</p>
        <p className="text-sm text-slate-600">Total: {formatarPreco(total)}</p>
      </div>
      <a aria-disabled={!href} href={href} className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${href ? "bg-blue-700 hover:bg-blue-800" : "pointer-events-none bg-slate-400"}`}>Continuar para checkout</a>
    </div>
  </div>;
}

export function ResumoAssentos({ selection, ticketTypes, onChangeTicketType }: ResumoAssentosProps) {
  if (!selection.length) return <p className="mt-4 text-sm text-slate-600" aria-live="polite">Nenhum assento selecionado.</p>;
  const total = calcularTotalSelecao(selection, ticketTypes);
  return <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4" aria-label="Resumo dos assentos selecionados">
    <h2 className="text-base font-semibold">Resumo da seleção</h2>
    <ul className="mt-3 space-y-3">
      {selection.map((seat) => <li key={seat.seatId} className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium">Assento {seat.label ?? seat.seatId}{seat.accessible ? " · acessível" : ""}</span>
        <label className="flex items-center gap-2 text-sm">Tipo de ingresso
          <select value={seat.ticketTypeId} onChange={(event) => onChangeTicketType(seat.seatId, event.target.value)} aria-label={`Tipo de ingresso do assento ${seat.label ?? seat.seatId}`} className="rounded border border-slate-300 bg-white px-2 py-1">
            <option value="">Selecione</option>
            {ticketTypes.map((type) => <option key={type.id} value={type.id}>{type.name} · {formatarPreco(type.priceCents)}</option>)}
          </select>
        </label>
      </li>)}
    </ul>
    <p className="mt-4 text-right font-semibold">Total: {formatarPreco(total)}</p>
  </section>;
}
