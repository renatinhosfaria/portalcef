import React from "react";
import type { PublicEventDetail, PublicEventSession } from "@essencia/shared/types";
import { formatarDataHoraExtenso } from "../../lib/eventos-formatters";
import { ImagemPublicaEvento } from "../imagem-publica-evento";

export function FaixaEvento({ evento, sessao }: { evento: PublicEventDetail; sessao: PublicEventSession }): React.JSX.Element {
  return <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e6e9e1] bg-white p-4 shadow-sm">
    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-[#f1f3ed]">
      <ImagemPublicaEvento src={evento.imageUrl} alt="" fill ajuste="conter" className="object-contain" sizes="96px" />
    </div>
    <div className="min-w-0">
      <p className="truncate font-display text-xl font-semibold text-[#1f2a24]">{evento.title}</p>
      <p className="mt-1 text-sm text-[#647066]">{formatarDataHoraExtenso(sessao.startsAt, sessao.endsAt)}</p>
    </div>
  </header>;
}
