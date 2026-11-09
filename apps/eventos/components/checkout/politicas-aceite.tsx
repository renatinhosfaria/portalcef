"use client";

import React from "react";
import type { PoliticaPublica } from "@essencia/shared/types";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@essencia/ui/components/dialog";
import { ordenarPoliticas, ROTULO_POLITICA } from "../../lib/politicas";

type Props = { politicas: PoliticaPublica[]; aceito: boolean; onAceitar: (value: boolean) => void };

export function PoliticasAceite({ politicas, aceito, onAceitar }: Props): React.JSX.Element {
  return <fieldset className="space-y-3">
    <legend className="text-lg font-semibold">Políticas do evento</legend>
    <label className="flex items-start gap-3 rounded-xl border border-[#d9ddcf] bg-white p-4">
      <input required type="checkbox" checked={aceito} onChange={(event) => onAceitar(event.target.checked)} aria-label="Li e aceito as políticas do evento" className="mt-1 h-5 w-5" />
      <span className="font-semibold">Li e aceito as políticas do evento</span>
    </label>
    <ul className="flex flex-wrap gap-2">
      {ordenarPoliticas(politicas).map((politica) => <li key={`${politica.type}-${politica.version}`}>
        <Dialog>
          <DialogTrigger asChild><button type="button" className="rounded-lg border border-[#d9ddcf] px-3 py-2 text-sm font-semibold text-[#3f6f12]">{ROTULO_POLITICA[politica.type]}</button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>{ROTULO_POLITICA[politica.type]}</DialogTitle></DialogHeader><p className="whitespace-pre-wrap text-sm text-[#475248]">{politica.content}</p><DialogClose asChild><button type="button" className="rounded-lg border px-3 py-2 text-sm font-semibold">Fechar</button></DialogClose></DialogContent>
        </Dialog>
      </li>)}
    </ul>
  </fieldset>;
}
