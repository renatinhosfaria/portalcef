import React from "react";
import Link from "next/link";
import type { PublicEventCard } from "@essencia/shared/types";
import { formatarDataHoraExtenso, formatarPrecoPublico, rotuloDisponibilidade } from "../../lib/eventos-formatters";
import { ImagemPublicaEvento } from "../imagem-publica-evento";

export function EventoDestaque({ event }: { event: PublicEventCard }): React.JSX.Element {
  const disponivel = event.availability === "available";
  return <article data-testid="evento-destaque" className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface-card)] shadow-sm md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
    <div className="relative min-h-[18rem] overflow-hidden bg-[var(--surface-muted)] md:min-h-[30rem]">
      {event.imageUrl && <div className="absolute inset-0 scale-110 opacity-60 blur-xl"><ImagemPublicaEvento src={event.imageUrl} alt="" fill ajuste="cobrir" className="object-cover" sizes="(min-width: 768px) 55vw, 100vw" /></div>}
      <div className="relative flex h-full min-h-[18rem] items-center justify-center p-5 md:min-h-[30rem] md:p-8"><ImagemPublicaEvento src={event.imageUrl} alt={event.title} fill ajuste="conter" className="object-contain" sizes="(min-width: 768px) 55vw, 100vw" /></div>
    </div>
    <div className="flex flex-col justify-center p-6 md:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-green-dark)]">{event.category ?? "Evento"}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">{event.title}</h2>
      <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">{event.summary ?? "Confira os detalhes e sessões disponíveis."}</p>
      <dl className="mt-7 grid gap-3 text-sm text-[var(--ink-muted)]">
        <div><dt className="font-semibold text-[var(--ink)]">Quando</dt><dd>{formatarDataHoraExtenso(event.startsAt ?? "")}</dd></div>
        <div><dt className="font-semibold text-[var(--ink)]">Onde</dt><dd>{event.locationName ?? "Local a confirmar"}</dd></div>
      </dl>
      <p className="mt-7 text-lg font-semibold">{formatarPrecoPublico(event.fromPriceCents)}</p>
      <div className="mt-6">{disponivel ? <Link href={`/evento/${event.slug}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--acao)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--acao-hover)]">Escolher assentos</Link> : <span className="text-sm font-semibold text-[var(--ink-muted)]">{rotuloDisponibilidade(event.availability)}</span>}</div>
    </div>
  </article>;
}
