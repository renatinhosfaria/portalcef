import React from "react";
import type { PublicEventDetail, PublicEventSession } from "@essencia/shared/types";
import { formatarDataHoraExtenso } from "../../lib/eventos-formatters";
import { hrefSessao, sessaoVendavel } from "../sessoes-evento";
import { ImagemPublicaEvento } from "../imagem-publica-evento";

function primeiroVendavel(sessions: PublicEventSession[]) {
  return sessions.filter(sessaoVendavel).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
}

export function TopoEvento({ event, sessions }: { event: PublicEventDetail; sessions: PublicEventSession[] }): React.JSX.Element {
  const vendaveis = sessions.filter(sessaoVendavel);
  const primeira = primeiroVendavel(vendaveis);
  const local = primeira?.location;
  const tipos = vendaveis.flatMap((session) => session.ticketTypes ?? []);
  const oferta = vendaveis.flatMap((session) => session.offers ?? [])[0];
  const destino = vendaveis.length === 1 ? hrefSessao(event.slug, vendaveis[0].id) : "#sessoes";
  const meia = tipos.some((tipo) => /meia/i.test(tipo.name) || /meia/i.test(tipo.eligibility ?? ""));
  const temMapa = sessions.some((session) => Boolean(session.mapId));
  return <header className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--tinta)] text-white shadow-sm">
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)] md:items-center md:gap-10 md:p-10">
      <div className="md:order-last">
        <ImagemPublicaEvento src={event.imageUrl} alt={`Imagem de ${event.title}`} width={1600} height={900} ajuste="conter" className={`${event.imageUrl ? "h-auto w-full" : "aspect-video w-full"} md:rounded-2xl`} sizes="(min-width: 768px) 45vw, 100vw" />
      </div>
      <div className="flex flex-col justify-center p-6 md:p-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--verde-colegio)]">{event.category ?? "Evento"}</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-5xl">{event.title}</h1>
        <p className="mt-5 text-base leading-7 text-white/80">{formatarDataHoraExtenso(primeira?.startsAt ?? event.startsAt)}</p>
        <p className="mt-2 text-base leading-7 text-white/80">{local?.name ?? event.locationName ?? "Local a confirmar"}{local?.address ? ` · ${local.address}` : ""}</p>
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          {temMapa && <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">Assentos numerados</span>}
          {meia && <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">Meia-entrada</span>}
          {oferta && <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">{oferta.discountPercent != null ? `${oferta.discountPercent}% off a partir de ${oferta.minQuantity} lugares` : `${oferta.name} a partir de ${oferta.minQuantity} lugares`}</span>}
        </div>
        {vendaveis.length > 0 && <a className="mt-7 hidden min-h-11 w-fit items-center justify-center rounded-lg bg-[var(--acao)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--acao-hover)] md:inline-flex" href={destino}>Escolher assentos</a>}
      </div>
    </div>
  </header>;
}
