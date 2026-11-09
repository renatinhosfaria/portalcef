"use client";

import React, { useState } from "react";
import type { ItemPedidoPublico, PoliticaPublica } from "@essencia/shared/types";
import { PoliticasAceite } from "./politicas-aceite";

type DadosCheckout = {
  buyer: { name: string; email: string; phone: string };
  participants: Array<{ participantIndex: number; fullName: string; type: "CONVIDADO" }>;
  aceitouPoliticas: boolean;
};

type Props = { items: ItemPedidoPublico[]; politicas: PoliticaPublica[]; onEnviar: (dados: DadosCheckout) => Promise<void>; bloqueado?: boolean };

export function FormularioDados({ items, politicas, onEnviar, bloqueado = false }: Props): React.JSX.Element {
  const [aceito, setAceito] = useState(false);
  const [faltas, setFaltas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const itensOrdenados = [...items].sort((a, b) => (a.participantIndex ?? Number.MAX_SAFE_INTEGER) - (b.participantIndex ?? Number.MAX_SAFE_INTEGER));

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const buyer = { name: String(form.get("buyerName") ?? "").trim(), email: String(form.get("buyerEmail") ?? "").trim(), phone: String(form.get("buyerPhone") ?? "").trim() };
    const participants = itensOrdenados.map((item, index) => { const participantIndex = item.participantIndex ?? index; return { participantIndex, fullName: String(form.get(`participant-${participantIndex}`) ?? "").trim(), type: "CONVIDADO" as const }; });
    const proximasFaltas = [
      buyer.name.length < 2 ? "nome completo" : "",
      !/^\S+@\S+\.\S+$/.test(buyer.email) ? "e-mail" : "",
      buyer.phone.replace(/\D/g, "").length < 8 ? "celular" : "",
      participants.some((participant) => participant.fullName.length < 2) ? "nomes dos participantes" : "",
      !aceito ? "aceite das políticas" : "",
    ].filter(Boolean);
    setFaltas(proximasFaltas);
    if (proximasFaltas.length || bloqueado) return;
    setEnviando(true);
    try { await onEnviar({ buyer, participants, aceitouPoliticas: aceito }); }
    finally { setEnviando(false); }
  }

  return <form onSubmit={enviar} noValidate className="space-y-6 rounded-2xl border border-[#e6e9e1] bg-white p-5 shadow-sm">
    <fieldset className="space-y-4"><legend className="font-display text-xl font-semibold text-[#1f2a24]">Seus dados</legend><p className="text-sm text-[#647066]">Usamos para identificar seu pedido e falar com você, se precisar.</p>
      <label className="block text-sm font-semibold">Nome completo<input required name="buyerName" autoComplete="name" className="mt-1 min-h-11 w-full rounded-lg border border-[#d9ddcf] p-3 font-normal" /></label>
      <label className="block text-sm font-semibold">E-mail<input required name="buyerEmail" type="email" autoComplete="email" className="mt-1 min-h-11 w-full rounded-lg border border-[#d9ddcf] p-3 font-normal" /></label>
      <label className="block text-sm font-semibold">Celular (WhatsApp)<input required name="buyerPhone" type="tel" inputMode="tel" autoComplete="tel" className="mt-1 min-h-11 w-full rounded-lg border border-[#d9ddcf] p-3 font-normal" /></label>
    </fieldset>
    <fieldset className="space-y-4"><legend className="font-display text-xl font-semibold text-[#1f2a24]">Quem vai sentar em cada lugar</legend>
      {itensOrdenados.map((item, index) => { const participantIndex = item.participantIndex ?? index; const rotulo = `${item.rowLabel}${item.seatNumber}`; return <div key={`${item.seatId}-${participantIndex}`}><label className="block text-sm font-semibold">Nome de quem vai sentar no lugar {rotulo}<input required name={`participant-${participantIndex}`} className="mt-1 min-h-11 w-full rounded-lg border border-[#d9ddcf] p-3 font-normal" /></label>{/meia/i.test(item.ticketTypeName) && <p className="mt-1 text-xs text-[#647066]">Leve o documento que dá direito ao desconto.</p>}</div>; })}
    </fieldset>
    <PoliticasAceite politicas={politicas} aceito={aceito} onAceitar={setAceito} />
    <button type="submit" disabled={enviando} className="min-h-12 rounded-xl bg-[#3f6f12] px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{enviando ? "Preparando pagamento…" : "Ir para o pagamento"}</button>
    {faltas.length > 0 && <p role="alert" className="rounded-lg border border-[#efb4b4] bg-[#fff1f1] p-3 text-sm text-[#8b1e1e]">Falta: {faltas.join(", ")}</p>}
  </form>;
}

export type { DadosCheckout };
