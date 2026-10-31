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
  return (precoCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ResumoAssentos({ selection, ticketTypes, onChangeTicketType }: ResumoAssentosProps) {
  if (!selection.length) return <p className="mt-4 text-sm text-slate-600" aria-live="polite">Nenhum assento selecionado.</p>;
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
  </section>;
}
