"use client";

import React from "react";
import type { PublicEventTicketType } from "@essencia/shared/types";
import { adicionarPacote } from "../../lib/composicao-pacotes";
import { formatarMoeda } from "../../lib/eventos-formatters";
import type { AssentoSelecionado } from "../assentos-types";

type Props = { selection: AssentoSelecionado[]; ticketTypes: PublicEventTicketType[]; onAdicionar: (tipoId: string) => void; onDesfazer: (pacoteId: string) => void };

export function SeletorPacotes({ selection, ticketTypes, onAdicionar, onDesfazer }: Props): React.JSX.Element | null {
  const tipos = ticketTypes.filter(tipo => (tipo.lugaresPorPacote ?? 1) > 1);
  if (!tipos.length) return null;
  const grupos = new Map<string, AssentoSelecionado[]>();
  for (const item of selection) if (item.pacoteId) grupos.set(item.pacoteId, [...(grupos.get(item.pacoteId) ?? []), item]);
  return <div className="mt-4 space-y-3" aria-label="Pacotes de ingressos">
    {tipos.map(tipo => <div key={tipo.id} className="rounded-xl border border-[#d9ddcf] p-3">
      <p className="font-semibold">{tipo.name}</p>
      <p className="text-sm text-[#647066]">Pacote de {tipo.lugaresPorPacote} lugares · {formatarMoeda(tipo.priceCents)}</p>
      <button type="button" aria-label={`Adicionar pacote ${tipo.name}`} disabled={adicionarPacote(selection, ticketTypes, tipo.id, "simulacao") === selection} onClick={() => onAdicionar(tipo.id)} className="mt-2 min-h-10 rounded-lg border border-[#3f6f12] px-3 text-sm font-semibold text-[#3f6f12] disabled:opacity-40">Adicionar pacote</button>
    </div>)}
    {[...grupos].map(([id, lugares]) => {
      const tipo = ticketTypes.find(item => item.id === lugares[0]?.ticketTypeId);
      return <div key={id} className="rounded-xl bg-[#eff4e8] p-3 text-sm">
        <p className="font-semibold">1 pacote · {tipo?.name ?? "Pacote"}</p>
        <p className="mt-1">Lugares: {lugares.map(item => item.label ?? item.seatId).join(", ")}</p>
        <button type="button" aria-label={`Desfazer pacote ${tipo?.name ?? "Pacote"}`} onClick={() => onDesfazer(id)} className="mt-2 min-h-10 font-semibold text-[#3f6f12] underline">Desfazer pacote</button>
      </div>;
    })}
  </div>;
}
