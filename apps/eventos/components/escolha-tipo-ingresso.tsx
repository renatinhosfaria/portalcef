import React from "react";
import Link from "next/link";
import type { PublicEventTicketType } from "@essencia/shared/types";
import { formatarPrecoPublico } from "../lib/eventos-formatters";

function detalhesDoTipo(tipo: PublicEventTicketType): string[] {
  return [tipo.description, tipo.eligibility ? `Elegibilidade: ${tipo.eligibility}` : null].filter((detalhe): detalhe is string => Boolean(detalhe));
}

export function EscolhaTipoIngresso({ eventSlug, sessionId, ticketTypes }: { eventSlug: string; sessionId: string; ticketTypes: PublicEventTicketType[] }): React.ReactElement {
  return <section className="space-y-4" aria-labelledby="escolha-tipo-ingresso-titulo">
    <div>
      <h1 id="escolha-tipo-ingresso-titulo" className="text-2xl font-bold">Escolha o tipo de ingresso</h1>
      <p className="mt-2 text-slate-600">Selecione uma opção antes de escolher seus assentos.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {ticketTypes.map((tipo) => <article key={tipo.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{tipo.name}</h2>
          <p className="mt-1 text-xl font-semibold text-slate-950">{formatarPrecoPublico(tipo.priceCents).replace("A partir de ", "")}</p>
          {detalhesDoTipo(tipo).map((detalhe) => <p key={detalhe} className="mt-2 text-sm text-slate-600">{detalhe}</p>)}
        </div>
        <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" href={`/evento/${eventSlug}/sessao/${sessionId}?ticketTypeId=${encodeURIComponent(tipo.id)}`}>Escolher assentos</Link>
      </article>)}
    </div>
  </section>;
}
