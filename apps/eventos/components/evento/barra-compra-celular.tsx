import React from "react";
import type { PublicEventDetail, PublicEventSession } from "@essencia/shared/types";
import { formatarMoeda, precoPrincipalPublico } from "../../lib/eventos-formatters";
import { hrefSessao, sessaoVendavel } from "../sessoes-evento";

export function BarraCompraCelular({ event, sessions }: { event: PublicEventDetail; sessions: PublicEventSession[] }): React.JSX.Element | null {
  const vendaveis = sessions.filter(sessaoVendavel);
  if (!vendaveis.length) return null;
  const menorPreco = precoPrincipalPublico(vendaveis.flatMap((session) => session.ticketTypes));
  const href = vendaveis.length === 1 ? hrefSessao(event.slug, vendaveis[0].id) : "#sessoes";
  return <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--cartao)]/95 p-3 shadow-lg backdrop-blur md:hidden"><div className="mx-auto flex max-w-2xl items-center justify-between gap-3"><p className="text-sm text-[var(--ink-muted)]">{menorPreco == null ? "Consulte" : <strong className="block text-base text-[var(--ink)]">{formatarMoeda(menorPreco)}</strong>}</p><a className="flex min-h-11 items-center justify-center rounded-lg bg-[var(--acao)] px-4 py-2 text-sm font-semibold text-white" href={href}>Escolher assentos</a></div></div>;
}
