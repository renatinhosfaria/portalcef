"use client";

import React, { useMemo, useState } from "react";
import type { PublicEventDetail, PublicEventSession } from "@essencia/shared/types";
import { formatarDataCurta, formatarMoeda } from "../../lib/eventos-formatters";
import { hrefSessao, sessaoVendavel } from "../sessoes-evento";

function rotuloSessao(session: PublicEventSession): string {
  const local = session.location?.name ? ` · ${session.location.name}` : "";
  return `${formatarDataCurta(session.startsAt)}${local}`;
}

export function CaixaCompra({ event, sessions }: { event: PublicEventDetail; sessions: PublicEventSession[] }): React.JSX.Element | null {
  const vendaveis = useMemo(() => sessions.filter(sessaoVendavel).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), [sessions]);
  const [sessionId, setSessionId] = useState(vendaveis[0]?.id ?? "");
  const session = vendaveis.find((item) => item.id === sessionId) ?? vendaveis[0];
  if (!session) return null;
  const menorPreco = Math.min(...session.ticketTypes.map((tipo) => tipo.priceCents));
  const oferta = session.offers?.find((item) => item.discountPercent != null);
  return <aside className="surface-card rounded-2xl p-5 shadow-sm lg:sticky lg:top-6">
    <h2 className="font-display text-xl font-semibold">Escolha seus ingressos</h2>
    {vendaveis.length >= 2 && <label className="mt-5 block text-sm font-semibold" htmlFor="sessao-compra">Sessão<select id="sessao-compra" className="mt-2 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--cartao)] px-3 text-sm font-normal" value={session.id} onChange={(event) => setSessionId(event.target.value)}>{vendaveis.map((item) => <option key={item.id} value={item.id}>{rotuloSessao(item)}</option>)}</select></label>}
    <p className="mt-5 text-sm text-[var(--ink-muted)]">Valores da sessão</p>
    <ul className="mt-2 divide-y divide-[var(--line)]">{session.ticketTypes.map((tipo) => <li key={tipo.id} className="flex items-baseline justify-between gap-3 py-3"><span className="font-medium">{tipo.name}</span><span className="font-semibold">{formatarMoeda(tipo.priceCents)}</span></li>)}</ul>
    {oferta?.discountPercent != null && <p className="mt-3 rounded-lg bg-[var(--aviso-fundo)] px-3 py-2 text-sm text-[var(--aviso-texto)]">{oferta.discountPercent}% de desconto a partir de {oferta.minQuantity} lugares.</p>}
    <p className="mt-4 text-sm text-[var(--ink-muted)]">A partir de <strong className="text-[var(--ink)]">{formatarMoeda(menorPreco)}</strong></p>
    <a className="mt-5 flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--acao)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--acao-hover)]" href={hrefSessao(event.slug, session.id)}>Escolher assentos</a>
    <div className="mt-5 space-y-2 border-t border-[var(--line)] pt-4 text-xs text-[var(--ink-muted)]"><p>Pagamento seguro · cartão ou Pix</p><p>Confirmação na hora, com número do pedido</p></div>
  </aside>;
}
