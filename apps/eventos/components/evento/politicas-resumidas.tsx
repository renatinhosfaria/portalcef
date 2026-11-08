"use client";

import React from "react";
import type { PoliticaPublica } from "@essencia/shared/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@essencia/ui/components/dialog";
import { ordenarPoliticas, ROTULO_POLITICA } from "../../lib/politicas";

export function PoliticasResumidas({ politicas, cancellationPolicy }: { politicas: PoliticaPublica[]; cancellationPolicy: string | null }): React.JSX.Element | null {
  const itens = politicas.length ? ordenarPoliticas(politicas) : cancellationPolicy ? [{ type: "CANCELAMENTO_REEMBOLSO" as const, version: 1, content: cancellationPolicy }] : [];
  if (!itens.length) return null;
  return <section aria-labelledby="politicas" className="mt-10"><h2 id="politicas" className="font-display text-2xl font-semibold">Políticas</h2><div className="mt-3 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--cartao)]">{itens.map((politica) => <Dialog key={`${politica.type}-${politica.version}`}><DialogTrigger asChild><button type="button" className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold hover:bg-[var(--surface-muted)]"><span>{ROTULO_POLITICA[politica.type]}</span><span aria-hidden="true">›</span></button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{ROTULO_POLITICA[politica.type]}</DialogTitle></DialogHeader><p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ink-muted)]">{politica.content}</p></DialogContent></Dialog>)}</div></section>;
}
