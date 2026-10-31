import React from "react";
import Link from "next/link";
import type { PublicEventSession } from "@essencia/shared/types";
import { formatarDataPublica, formatarPrecoPublico, rotuloDisponibilidade } from "../lib/eventos-formatters";

const fuso = "America/Sao_Paulo";

function normalizarData(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function chaveDoDia(value: Date | string): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(normalizarData(value));
  return `${partes.find((item) => item.type === "year")?.value}-${partes.find((item) => item.type === "month")?.value}-${partes.find((item) => item.type === "day")?.value}`;
}

export function agruparSessoesPorDia(sessions: PublicEventSession[]) {
  const grupos = new Map<string, PublicEventSession[]>();
  for (const session of sessions) {
    const key = chaveDoDia(session.startsAt);
    grupos.set(key, [...(grupos.get(key) ?? []), session]);
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => ({
    key,
    label: new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: fuso }).format(new Date(`${key}T12:00:00-03:00`)),
    sessions: items.sort((a, b) => normalizarData(a.startsAt).getTime() - normalizarData(b.startsAt).getTime()),
  }));
}

function horario(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso }).format(normalizarData(value));
}

function janelaDeVendas(session: PublicEventSession): string {
  const inicio = session.salesStartsAt ? formatarDataPublica(session.salesStartsAt, { hour: "2-digit", minute: "2-digit" }) : null;
  const fim = session.salesEndsAt ? formatarDataPublica(session.salesEndsAt, { hour: "2-digit", minute: "2-digit" }) : null;
  if (inicio && fim) return `Venda: de ${inicio} a ${fim} (horário de São Paulo)`;
  if (inicio) return `Venda: a partir de ${inicio} (horário de São Paulo)`;
  if (fim) return `Venda: até ${fim} (horário de São Paulo)`;
  return "Venda: janela não informada";
}

function detalhesDoTipo(tipo: PublicEventSession["ticketTypes"][number]): string {
  return [tipo.description, tipo.eligibility ? `Elegibilidade: ${tipo.eligibility}` : null].filter(Boolean).join(" · ");
}

export function SessoesEvento({ eventSlug, sessions }: { eventSlug: string; sessions: PublicEventSession[] }): React.ReactElement {
  if (!sessions.length) return <p className="rounded-xl border border-dashed p-5 text-slate-600">Nenhuma sessão publicada no momento.</p>;
  return <div className="space-y-6">{agruparSessoesPorDia(sessions).map((grupo) => <section key={grupo.key} aria-labelledby={`dia-${grupo.key}`}>
    <h3 id={`dia-${grupo.key}`} className="mb-3 text-lg font-semibold capitalize">{grupo.label}</h3>
    <div className="space-y-3">{grupo.sessions.map((session) => {
      const tipos = session.ticketTypes ?? [];
      const vendavel = session.availability === "available" && Boolean(session.mapId) && tipos.length > 0;
      return <article key={session.id} className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xl font-semibold">{horario(session.startsAt)}{session.endsAt ? `–${horario(session.endsAt)}` : ""}</p><p className="text-sm text-slate-600">{session.location?.name ?? "Local a confirmar"}{session.location?.room ? ` · ${session.location.room}` : ""}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{session.availability === "sold_out" ? "Esgotada" : rotuloDisponibilidade(session.availability)}</span></div>
        {session.location?.address && <p className="mt-2 text-sm text-slate-600">{session.location.address}</p>}
        {session.location?.instructions && <p className="mt-2 text-sm text-slate-700"><strong>Instruções:</strong> {session.location.instructions}</p>}
        {session.location?.accessibility && <p className="mt-2 text-sm text-slate-700"><strong>Acessibilidade:</strong> {session.location.accessibility}</p>}
        <p className="mt-2 text-sm text-slate-600">{janelaDeVendas(session)}</p>
        {session.availability === "sold_out" ? <p className="mt-4 text-sm font-medium text-rose-700">Sessão esgotada.</p> : !vendavel ? <p className="mt-4 text-sm text-amber-700">Sessão não vendável no momento.</p> : tipos.length === 1 ? <Link className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 font-medium text-white" href={`/evento/${eventSlug}/sessao/${session.id}?ticketTypeId=${encodeURIComponent(tipos[0].id)}`}>Escolher assentos · {tipos[0].name} ({formatarPrecoPublico(tipos[0].priceCents).replace("A partir de ", "")}){detalhesDoTipo(tipos[0]) && <span className="mt-1 block text-sm font-normal">{detalhesDoTipo(tipos[0])}</span>}</Link> : <fieldset className="mt-4 space-y-2"><legend className="font-medium">Escolha o tipo de ingresso</legend>{tipos.map((tipo) => <Link key={tipo.id} className="block text-blue-700 underline" href={`/evento/${eventSlug}/sessao/${session.id}?ticketTypeId=${encodeURIComponent(tipo.id)}`}><span className="font-medium">{tipo.name} · {formatarPrecoPublico(tipo.priceCents).replace("A partir de ", "")}</span>{detalhesDoTipo(tipo) && <span className="block text-sm text-slate-600">{detalhesDoTipo(tipo)}</span>}</Link>)}</fieldset>}
      </article>;
    })}</div>
  </section>)}</div>;
}
