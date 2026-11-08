import React from "react";
import type { PublicEventSession } from "@essencia/shared/types";
import { sessaoVendavel } from "../sessoes-evento";

export function BomSaber({ sessions }: { sessions: PublicEventSession[] }): React.JSX.Element {
  const vendaveis = sessions.filter(sessaoVendavel);
  const meia = vendaveis.flatMap((session) => session.ticketTypes).find((tipo) => /meia/i.test(tipo.name) || /meia/i.test(tipo.eligibility ?? ""));
  const oferta = vendaveis.flatMap((session) => session.offers ?? [])[0];
  const acessibilidade = vendaveis.map((session) => session.location?.accessibility).find(Boolean) ?? "Assentos acessíveis marcados no mapa.";
  const temMapa = sessions.some((session) => Boolean(session.mapId));
  return <section aria-labelledby="bom-saber"><h2 id="bom-saber" className="font-display text-2xl font-semibold">Bom saber</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">
    {meia && <article className="surface-card rounded-xl p-4"><h3 className="font-semibold">Meia-entrada</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{meia.eligibility ?? "Consulte as condições da meia-entrada."}</p></article>}
    {temMapa && <article className="surface-card rounded-xl p-4"><h3 className="font-semibold">Lugares numerados</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Escolha seu lugar no mapa antes de pagar.</p></article>}
    {oferta && <article className="surface-card rounded-xl p-4"><h3 className="font-semibold">Grupos</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{oferta.discountPercent != null ? `${oferta.discountPercent}% de desconto a partir de ${oferta.minQuantity} lugares.` : `${oferta.name} a partir de ${oferta.minQuantity} lugares.`}</p></article>}
    <article className="surface-card rounded-xl p-4"><h3 className="font-semibold">Acessibilidade</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{acessibilidade}</p></article>
  </div></section>;
}
