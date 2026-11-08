import React from "react";
import type { PublicEventCard } from "@essencia/shared/types";
import { EventoCard } from "./evento-card";
import { EventoDestaque } from "./catalogo/evento-destaque";

export function CatalogoEventos({ events }: { events: PublicEventCard[] }): React.JSX.Element {
  if (events.length === 1) return <EventoDestaque event={events[0]} />;
  return <div data-testid="catalogo-grade" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{events.map((event) => <EventoCard key={event.id} event={event} />)}</div>;
}
