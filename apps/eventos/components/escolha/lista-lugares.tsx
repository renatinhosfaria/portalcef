"use client";

import React from "react";
import type { PublicMap, PublicSeat } from "@essencia/shared/types";
import { rotuloCurto } from "../../lib/eventos-formatters";

export function ListaLugares({ map, selecionados, indisponiveis = new Set(), onAlternar }: { map: PublicMap; selecionados: ReadonlySet<string>; indisponiveis?: ReadonlySet<string>; onAlternar: (seatId: string) => void }): React.JSX.Element {
  const assentosPorFileira = map.seats.reduce((grupos, seat) => {
    const lista = grupos.get(seat.rowLabel) ?? [];
    lista.push(seat);
    grupos.set(seat.rowLabel, lista);
    return grupos;
  }, new Map<string, PublicSeat[]>());
  return <section aria-label="Lugares disponíveis" className="rounded-2xl border border-[#e6e9e1] bg-white p-4">
    <h2 className="font-display text-xl font-semibold text-[#1f2a24]">Lugares em lista</h2>
    <div className="mt-4 space-y-4">
      {[...assentosPorFileira.entries()].map(([fileira, assentos]) => <section key={fileira} aria-labelledby={`fileira-${fileira}`}>
        <h3 id={`fileira-${fileira}`} className="text-sm font-semibold text-[#647066]">Fileira {fileira}</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {assentos.map((seat) => {
            const indisponivel = seat.state !== "available" || indisponiveis.has(seat.id);
            const selecionado = selecionados.has(seat.id);
            return <li key={seat.id}>
              <button type="button" disabled={indisponivel} aria-pressed={selecionado} aria-label={`${indisponivel ? "Indisponível" : "Selecionar"} ${rotuloCurto(seat)}`} onClick={() => onAlternar(seat.id)} className={`min-h-11 w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold ${selecionado ? "border-[#3f6f12] bg-[#3f6f12] text-white" : indisponivel ? "cursor-not-allowed border-[#e6e9e1] bg-[#f1f3ed] text-[#929b92]" : "border-[#d9ddcf] bg-white text-[#1f2a24] hover:border-[#3f6f12]"}`}>
                {rotuloCurto(seat)} {indisponivel ? "· indisponível" : selecionado ? "· selecionado" : "· livre"}
              </button>
            </li>;
          })}
        </ul>
      </section>)}
    </div>
  </section>;
}
