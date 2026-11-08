import React from "react";
import type { PublicEventCard } from "@essencia/shared/types";
import { CatalogoPublico } from "../components/catalogo-publico";
import { listarEventosPublicosServidor } from "../lib/eventos-api-servidor";

export default async function Page() {
  // O estado de erro usa role="alert" e a mensagem "Não foi possível carregar os eventos".
  let events: PublicEventCard[] = [];
  let error = false;
  try { events = await listarEventosPublicosServidor(); } catch { error = true; }
  return <section className="content-width py-12 md:py-16"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-green-dark)]">Programação</p><h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Eventos do Colégio Essência Feliz</h1><p className="mt-4 mb-10 max-w-2xl text-lg text-[var(--ink-muted)]">Encontre experiências para viver com a comunidade Essência Feliz.</p><CatalogoPublico events={events} error={error} /></section>;
}
