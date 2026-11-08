import React from "react";
import Image from "next/image";
import { INSTITUICAO } from "../../lib/instituicao";

export function QuemOrganiza(): React.JSX.Element {
  return <section aria-labelledby="quem-organiza" className="mt-10"><h2 id="quem-organiza" className="font-display text-2xl font-semibold">Quem organiza</h2><div className="surface-card mt-4 flex flex-wrap items-center gap-4 rounded-xl p-4"><Image src="/logo.png" alt="Logo do Colégio Essência Feliz" width={72} height={72} className="h-16 w-16 rounded-lg object-contain" /><div className="min-w-40 flex-1"><h3 className="font-semibold">{INSTITUICAO.nome}</h3><p className="mt-1 text-sm text-[var(--ink-muted)]">Uberlândia, MG</p></div><a href={INSTITUICAO.telefoneHref} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--acao)] px-4 py-2 text-sm font-semibold text-[var(--acao)]">Fale com o colégio</a></div></section>;
}
