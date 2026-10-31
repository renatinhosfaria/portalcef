"use client";

import React, { useState } from "react";
import type { PublicEventCard } from "@essencia/shared/types";
import { CatalogoEstados } from "./catalogo-estados";
import { CatalogoEventos } from "./catalogo-eventos";
import { listarEventosPublicos } from "../lib/eventos-api";

export function CatalogoPublico({ events, error }: { events: PublicEventCard[]; error: boolean }): React.JSX.Element {
  const [catalogo, setCatalogo] = useState(events);
  const [falhou, setFalhou] = useState(error);
  const [tentando, setTentando] = useState(false);

  async function tentarNovamente() {
    setTentando(true);
    try {
      setCatalogo(await listarEventosPublicos());
      setFalhou(false);
    } catch {
      setFalhou(true);
    } finally {
      setTentando(false);
    }
  }

  return <>{falhou ? <CatalogoEstados kind="error" onRetry={tentarNovamente} loading={tentando} /> : catalogo.length ? <CatalogoEventos events={catalogo} /> : <CatalogoEstados kind="empty" />}</>;
}
