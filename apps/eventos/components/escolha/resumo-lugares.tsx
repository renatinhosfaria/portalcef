"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { OfertaPrecoPublica, PublicEventTicketType } from "@essencia/shared/types";
import type { AssentoSelecionado } from "../../lib/selecao-lugares";
import { calcularPrecoSelecao } from "../../lib/selecao-lugares";

function formatarPreco(cents: number): string { return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " "); }

export function faltaTipoIngresso(selection: AssentoSelecionado[], ticketTypes: PublicEventTicketType[]): boolean {
  return selection.some((seat) => !ticketTypes.some((type) => type.id === seat.ticketTypeId));
}

export function ResumoLugares({ selection, ticketTypes, offers = [], onChangeTicketType }: { selection: AssentoSelecionado[]; ticketTypes: PublicEventTicketType[]; offers?: OfertaPrecoPublica[]; onChangeTicketType: (seatId: string, ticketTypeId: string) => void }): React.JSX.Element {
  const preco = calcularPrecoSelecao(selection, ticketTypes, offers);
  const oferta = offers.find((item) => selection.length < item.minQuantity);
  const progresso = oferta ? Math.min(100, (selection.length / oferta.minQuantity) * 100) : 100;
  return <section id="resumo-lugares" aria-label="Resumo dos lugares" className="rounded-2xl border border-[#e6e9e1] bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold text-[#1f2a24]">Seus lugares</h2><span className="rounded-full bg-[#eff4e8] px-2.5 py-1 text-xs font-semibold text-[#3f6f12]">{selection.length}</span></div>
    {!selection.length ? <p className="mt-4 text-sm text-[#647066]">Escolha um lugar no mapa para continuar.</p> : <>
      <ul className="mt-4 space-y-3">
        <AnimatePresence initial={false}>{selection.map((seat) => <motion.li key={seat.seatId} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="rounded-xl border border-[#e6e9e1] p-3">
          <div className="flex items-center justify-between gap-3"><span className="font-semibold text-[#1f2a24]">{seat.label ?? seat.seatId}</span>{seat.accessible ? <span className="text-xs text-[#2563eb]">Acessível</span> : null}</div>
          <div role="radiogroup" aria-label={`Tipo de ingresso do lugar ${seat.label ?? seat.seatId}`} className="mt-2 flex flex-wrap gap-2">
            {ticketTypes.map((type) => <label key={type.id} className="cursor-pointer"><input type="radio" name={`tipo-${seat.seatId}`} value={type.id} checked={seat.ticketTypeId === type.id} onChange={() => onChangeTicketType(seat.seatId, type.id)} className="peer sr-only" /><span className="inline-flex min-h-10 items-center rounded-lg border border-[#d9ddcf] px-2.5 text-xs font-semibold text-[#1f2a24] peer-checked:border-[#3f6f12] peer-checked:bg-[#3f6f12] peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[#3f6f12]">{type.name} · {formatarPreco(type.priceCents)}</span></label>)}
          </div>
        </motion.li>)}</AnimatePresence>
      </ul>
      {faltaTipoIngresso(selection, ticketTypes) && <p className="mt-3 text-sm font-semibold text-[#9a6700]">Escolha Inteira ou Meia-entrada em cada lugar</p>}
    </>}
    {offers.length > 0 && <div className="mt-5 rounded-xl bg-[#f5f7f1] p-3"><div className="flex justify-between gap-3 text-xs font-semibold text-[#647066]"><span>{oferta ? `Oferta a partir de ${oferta.minQuantity} lugares` : "Oferta aplicada"}</span><span>{selection.length}/{oferta?.minQuantity ?? selection.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dfe5d8]"><div className="h-full rounded-full bg-[#a3d154] transition-all" style={{ width: `${progresso}%` }} /></div></div>}
    <motion.div layout className="mt-5 border-t border-[#e6e9e1] pt-4" aria-live="polite"><div className="flex justify-between text-sm text-[#647066]"><span>Subtotal</span><span>{formatarPreco(preco.subtotalCents)}</span></div><div className="mt-1 flex justify-between text-sm text-[#647066]"><span>Desconto</span><span>{formatarPreco(preco.discountCents)}</span></div><div className="mt-2 flex justify-between text-lg font-semibold text-[#1f2a24]"><span>Total</span><span>{formatarPreco(preco.totalCents)}</span></div></motion.div>
  </section>;
}
