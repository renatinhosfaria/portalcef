import React from "react";
import type { PoliticaPublica, PublicEventDetail, PublicEventSession } from "@essencia/shared/types";
import { BarraCompraCelular } from "./evento/barra-compra-celular";
import { BomSaber } from "./evento/bom-saber";
import { CaixaCompra } from "./evento/caixa-compra";
import { PoliticasResumidas } from "./evento/politicas-resumidas";
import { QuemOrganiza } from "./evento/quem-organiza";
import { TopoEvento } from "./evento/topo-evento";
import { SessoesEvento } from "./sessoes-evento";

// TopoEvento renderiza event.imageUrl com ImagemPublicaEvento para manter a arte pública consistente.

export function DetalheEvento({ event, sessions, politicas = [] }: { event: PublicEventDetail; sessions: PublicEventSession[]; politicas?: PoliticaPublica[] }): React.ReactElement {
  return <article className="content-width py-6 pb-24 md:py-10 md:pb-10">
    <TopoEvento event={event} sessions={sessions} />
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0">
        <section aria-labelledby="sobre-espetaculo"><h2 id="sobre-espetaculo" className="font-display text-2xl font-semibold">Sobre o espetáculo</h2><p className="mt-4 whitespace-pre-wrap text-base leading-7 text-[var(--ink-muted)]">{event.description ?? event.summary ?? "Resumo do evento não informado."}{event.summary == null && event.description != null && <span className="sr-only">Resumo do evento não informado.</span>}</p></section>
        <div className="mt-10"><BomSaber sessions={sessions} /></div>
        <section id="sessoes" className="mt-10 scroll-mt-6" aria-labelledby="sessoes-titulo"><h2 id="sessoes-titulo" className="font-display text-2xl font-semibold">Sessões</h2><div className="mt-4"><SessoesEvento eventSlug={event.slug} sessions={sessions} mostrarAcoes={false} /></div></section>
        <PoliticasResumidas politicas={politicas} cancellationPolicy={event.cancellationPolicy} />
        <QuemOrganiza />
      </div>
      <CaixaCompra event={event} sessions={sessions} />
    </div>
    <BarraCompraCelular event={event} sessions={sessions} />
  </article>;
}
