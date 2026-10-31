import React from "react";
import type { PublicEventCard } from "@essencia/shared/types";
import { EventoCard } from "./evento-card";

export function CatalogoEventos({ events }: { events: PublicEventCard[] }): React.JSX.Element {
  // Os cards disponíveis apontam para /evento/{slug}; estados sem venda permanecem informativos.
  return <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{events.map((event) => <EventoCard key={event.id} event={event} />)}</div>;
}
