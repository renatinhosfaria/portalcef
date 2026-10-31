import React from "react";
import type { PublicEventCard } from "@essencia/shared/types";
import { CatalogoEstados } from "./catalogo-estados";
import { CatalogoEventos } from "./catalogo-eventos";

export function CatalogoPublico({ events, error }: { events: PublicEventCard[]; error: boolean }): React.JSX.Element {
  return <>{error ? <CatalogoEstados kind="error" /> : events.length ? <CatalogoEventos events={events} /> : <CatalogoEstados kind="empty" />}</>;
}
