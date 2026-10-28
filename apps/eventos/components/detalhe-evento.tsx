import React from "react";
import Link from "next/link";
import type { PublicEventDetail, PublicEventSession } from "@essencia/shared/types";

const formatPrice = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export function DetalheEvento({ event, sessions }: { event: PublicEventDetail; sessions: PublicEventSession[] }) {
  return <article><h1 className="text-3xl font-bold">{event.title}</h1><p className="mt-3 whitespace-pre-wrap text-slate-700">{event.description ?? event.summary}</p>{event.cancellationPolicy && <section className="mt-6 rounded-xl bg-amber-50 p-4"><h2 className="font-semibold">Política de cancelamento</h2><p>{event.cancellationPolicy}</p></section>}<h2 className="mt-8 text-xl font-semibold">Sessões disponíveis</h2><ul className="mt-3 space-y-3">{sessions.map((session) => {
    const types = session.ticketTypes ?? [];
    return <li key={session.id} className="rounded-xl border bg-white p-4"><div>{new Date(session.startsAt).toLocaleString("pt-BR")}</div><div className="text-sm text-slate-600">{session.location?.name ?? "Local a confirmar"} · {session.availability === "available" ? "Disponível" : session.availability === "sold_out" ? "Esgotada" : "Indisponível"}</div>{session.mapId && session.availability === "available" && (types.length === 1 ? <Link className="mt-3 inline-block text-blue-700 underline" href={`/evento/${event.slug}/sessao/${session.id}?ticketTypeId=${encodeURIComponent(types[0].id)}`}>Escolher assentos ({types[0].name} · {formatPrice(types[0].priceCents)})</Link> : types.length > 1 ? <fieldset className="mt-4 space-y-2"><legend className="font-medium">Escolha o tipo de ingresso</legend>{types.map((type) => <Link key={type.id} className="block text-blue-700 underline" href={`/evento/${event.slug}/sessao/${session.id}?ticketTypeId=${encodeURIComponent(type.id)}`}>{type.name} · {formatPrice(type.priceCents)}</Link>)}</fieldset> : <p className="mt-3 text-sm text-amber-700">Ingressos indisponíveis para esta sessão.</p>)}</li>;
  })}</ul></article>;
}
