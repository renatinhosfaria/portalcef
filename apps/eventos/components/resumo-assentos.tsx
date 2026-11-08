"use client";

import React from "react";
import { calcularPrecoPedido, type OfertaPreco, type ResultadoPrecoPedido } from "@essencia/shared/eventos/precos";
import type { OfertaPrecoPublica, PublicEventTicketType } from "@essencia/shared/types";
import type { AssentoSelecionado } from "./assentos-types";

export type { AssentoSelecionado } from "./assentos-types";

export type ResumoAssentosProps = {
  selection: AssentoSelecionado[];
  ticketTypes: PublicEventTicketType[];
  offers?: OfertaPrecoPublica[];
  onChangeTicketType: (seatId: string, ticketTypeId: string) => void;
};

function formatarPreco(precoCents: number) {
  return (precoCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");
}

function ofertasParaCalculo(offers: OfertaPrecoPublica[]): OfertaPreco[] {
  return offers.map((offer) => ({
    ...offer,
    pricingType: "PERCENTUAL" as const,
    priceCents: null,
    active: true,
  }));
}

export function calcularPrecoSelecao(selection: AssentoSelecionado[], ticketTypes: PublicEventTicketType[], offers: OfertaPrecoPublica[] = []): ResultadoPrecoPedido {
  const precos = new Map(ticketTypes.map((type) => [type.id, type.priceCents]));
  return calcularPrecoPedido({
    items: selection.map((seat, participantIndex) => ({
      seatId: seat.seatId,
      ticketTypeId: seat.ticketTypeId,
      participantIndex,
      basePriceCents: precos.get(seat.ticketTypeId) ?? 0,
    })),
    offers: ofertasParaCalculo(offers),
  });
}

export function calcularTotalSelecao(selection: AssentoSelecionado[], ticketTypes: PublicEventTicketType[]): number {
  return calcularPrecoSelecao(selection, ticketTypes).subtotalCents;
}

function formatarOferta(offers: OfertaPrecoPublica[], quantidade: number): string | null {
  if (quantidade === 0) return null;
  const oferta = offers.find((item) => quantidade < item.minQuantity || (quantidade >= item.minQuantity && quantidade <= (item.maxQuantity ?? Number.POSITIVE_INFINITY)));
  if (!oferta || oferta.discountPercent == null) return null;
  return `${oferta.discountPercent}% de desconto a partir de ${oferta.minQuantity} lugares`;
}

function faltaEscolherTipo(selection: AssentoSelecionado[], ticketTypes: PublicEventTicketType[]): boolean {
  return selection.some((seat) => !ticketTypes.some((type) => type.id === seat.ticketTypeId));
}

export type ResumoAssentosFixoProps = ResumoAssentosProps & { checkoutHref?: string };

export function ResumoAssentosFixo({ selection, ticketTypes, offers = [], checkoutHref }: ResumoAssentosFixoProps) {
  const preco = calcularPrecoSelecao(selection, ticketTypes, offers);
  const completo = selection.length > 0 && !faltaEscolherTipo(selection, ticketTypes);
  const href = completo ? checkoutHref : undefined;
  const mensagemOferta = formatarOferta(offers, selection.length);

  return <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:hidden" role="region" aria-label="Resumo fixo da seleção">
    <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">{selection.length ? `${selection.length} assento(s) selecionado(s)` : "Nenhum assento selecionado"}</p>
        {selection.length > 0 && !completo && <a href="#resumo-selecao" className="block text-xs font-semibold text-amber-800 underline">Escolha o tipo de ingresso de cada assento</a>}
        {mensagemOferta && <p className="text-xs text-blue-700">{mensagemOferta}</p>}
        <p className="text-xs text-slate-600" aria-live="polite">Subtotal: {formatarPreco(preco.subtotalCents)} · Desconto: {formatarPreco(preco.discountCents)}</p>
        <p className="text-sm font-semibold text-slate-700" aria-live="polite">Total: {formatarPreco(preco.totalCents)}</p>
      </div>
      <a aria-disabled={!href} href={href} className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${href ? "bg-blue-700 hover:bg-blue-800" : "pointer-events-none bg-slate-400"}`}>Continuar para checkout</a>
    </div>
  </div>;
}

export function ResumoAssentos({ selection, ticketTypes, offers = [], onChangeTicketType }: ResumoAssentosProps) {
  if (!selection.length) return <p className="mt-4 text-sm text-slate-600" aria-live="polite">Nenhum assento selecionado.</p>;
  const preco = calcularPrecoSelecao(selection, ticketTypes, offers);
  const mensagemOferta = formatarOferta(offers, selection.length);
  const regrasDosTipos = ticketTypes.filter((type) => type.eligibility?.trim());
  return <section id="resumo-selecao" className="mt-5 scroll-mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4" aria-label="Resumo dos assentos selecionados">
    <h2 className="text-base font-semibold">Resumo da seleção</h2>
    <ul className="mt-3 space-y-3">
      {selection.map((seat) => <li key={seat.seatId} className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium">Assento {seat.label ?? seat.seatId}{seat.accessible ? " · acessível" : ""}</span>
        <div role="radiogroup" aria-label={`Tipo de ingresso do assento ${seat.label ?? seat.seatId}`} className="flex flex-wrap gap-2">
          {ticketTypes.map((type) => <label key={type.id} className="cursor-pointer">
            <input type="radio" name={`tipo-ingresso-${seat.seatId}`} value={type.id} checked={seat.ticketTypeId === type.id} onChange={() => onChangeTicketType(seat.seatId, type.id)} className="peer sr-only" />
            <span className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 peer-checked:border-blue-700 peer-checked:bg-blue-700 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-700">{type.name} · {formatarPreco(type.priceCents)}</span>
          </label>)}
        </div>
      </li>)}
    </ul>
    {faltaEscolherTipo(selection, ticketTypes) && <p className="mt-3 text-sm font-medium text-amber-800">Escolha o tipo de ingresso de cada assento para continuar.</p>}
    {regrasDosTipos.length > 0 && <ul className="mt-3 space-y-1 text-xs text-slate-600">{regrasDosTipos.map((type) => <li key={type.id}>{type.name}: {type.eligibility}</li>)}</ul>}
    <div className="mt-4 space-y-1 text-right text-sm" aria-live="polite">
      {mensagemOferta && <p className="font-medium text-blue-700">{mensagemOferta}</p>}
      <p>Quantidade: {selection.length} assento(s)</p>
      <p>Subtotal: {formatarPreco(preco.subtotalCents)}</p>
      <p>Desconto: {formatarPreco(preco.discountCents)}</p>
      <p className="font-semibold">Total: {formatarPreco(preco.totalCents)}</p>
    </div>
  </section>;
}
