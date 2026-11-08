import React from "react";
import Link from "next/link";
import type { PublicEventCard } from "@essencia/shared/types";
import { formatarDataCurta, formatarPrecoPublico, rotuloDisponibilidade } from "../lib/eventos-formatters";
import { ImagemPublicaEvento } from "./imagem-publica-evento";

export function EventoCard({ event }: { event: PublicEventCard }): React.JSX.Element {
  const disponivel = event.availability === "available";
  const conteudo = <>
    <div className="relative aspect-[16/9] overflow-hidden bg-[var(--surface-muted)]">
      <ImagemPublicaEvento src={event.imageUrl} alt={event.title} fill className="h-full w-full object-cover transition duration-300 group-hover:scale-105" sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
    </div>
    <div className="flex flex-1 flex-col p-5">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-green-dark)]"><span>{event.category ?? "Evento"}</span><span>{rotuloDisponibilidade(event.availability)}</span></div>
      <h2 className="mt-3 font-display text-2xl font-semibold">{event.title}</h2>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--ink-muted)]">{event.summary ?? "Confira os detalhes e sessões disponíveis."}</p>
      <dl className="mt-5 grid gap-2 text-sm text-[var(--ink-muted)]">
        <div className="flex justify-between gap-3"><dt>Data</dt><dd className="text-right font-medium text-[var(--ink)]">{event.startsAt ? formatarDataCurta(event.startsAt) : "Data a confirmar"}</dd></div>
        <div className="flex justify-between gap-3"><dt>Local</dt><dd className="text-right font-medium text-[var(--ink)]">{event.locationName ?? "Local a confirmar"}</dd></div>
        <div className="flex justify-between gap-3"><dt>Ingressos</dt><dd className="text-right font-medium text-[var(--ink)]">{formatarPrecoPublico(event.fromPriceCents)}</dd></div>
      </dl>
      <div className="mt-6">{disponivel ? <span className="inline-flex rounded-full bg-[var(--brand-green)] px-4 py-2 text-sm font-semibold text-[var(--ink)]">Ver evento</span> : <span className="text-sm font-semibold text-[var(--ink-muted)]">{rotuloDisponibilidade(event.availability)}</span>}</div>
    </div>
  </>;
  return disponivel ? <Link data-testid="evento-card" href={`/evento/${event.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface-card)] shadow-sm transition hover:-translate-y-1 hover:shadow-lg">{conteudo}</Link> : <article data-testid="evento-card" className="flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface-card)] shadow-sm">{conteudo}</article>;
}
