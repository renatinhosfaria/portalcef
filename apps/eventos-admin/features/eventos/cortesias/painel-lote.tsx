"use client";

import React from "react";
import type { EstadoEmissao } from "./use-emissao-cortesias";

interface AssentoLote { seatId: string; rotulo: string; nome: string; conflito: boolean }
type CampoLote = "grupo" | "motivo" | "contatoEmail" | "contatoTelefone";

export interface PainelLoteProps {
  assentos: AssentoLote[];
  estado: EstadoEmissao;
  aoRemover(seatId: string): void;
  aoDefinirNome(seatId: string, nome: string): void;
  aoDefinirCampo(campo: CampoLote, valor: string): void;
  aoEmitir(): void;
}

export function PainelLote({ assentos, estado, aoRemover, aoDefinirNome, aoDefinirCampo, aoEmitir }: PainelLoteProps): React.JSX.Element {
  const quantidade = estado.selecionados.length;
  const textoBotao = quantidade === 0 ? "Emitir cortesias" : `Emitir ${quantidade} ${quantidade === 1 ? "cortesia" : "cortesias"}`;
  return (
    <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Lote de cortesias</h2>
        <p className="text-sm text-slate-600">{quantidade} {quantidade === 1 ? "assento selecionado" : "assentos selecionados"}</p>
      </div>
      {assentos.length > 0 && <div className="space-y-2" aria-label="Assentos selecionados">{assentos.map((assento) => (
        <div key={assento.seatId} className="rounded-lg border border-slate-200 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-800">{assento.rotulo}</span>
            <button type="button" className="text-xs text-slate-600 underline" onClick={() => aoRemover(assento.seatId)}>Remover</button>
          </div>
          <label className="mt-2 block text-sm text-slate-700">Nome para {assento.rotulo}
            <input aria-label={`Nome para ${assento.rotulo}`} aria-invalid={assento.conflito} value={assento.nome} onChange={(evento) => aoDefinirNome(assento.seatId, evento.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" />
          </label>
        </div>
      ))}</div>}
      <label className="block text-sm text-slate-700">Grupo
        <input aria-label="Grupo" value={estado.grupo} onChange={(evento) => aoDefinirCampo("grupo", evento.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" />
      </label>
      <label className="block text-sm text-slate-700">Motivo
        <textarea aria-label="Motivo" value={estado.motivo} onChange={(evento) => aoDefinirCampo("motivo", evento.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" rows={2} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-700">E-mail de contato<input aria-label="E-mail de contato" value={estado.contatoEmail} onChange={(evento) => aoDefinirCampo("contatoEmail", evento.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" type="email" /></label>
        <label className="block text-sm text-slate-700">Telefone de contato<input aria-label="Telefone de contato" value={estado.contatoTelefone} onChange={(evento) => aoDefinirCampo("contatoTelefone", evento.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
      </div>
      {estado.limiteAtingido && <p role="alert" className="text-sm text-amber-700">Limite de 50 assentos por emissão.</p>}
      {estado.erro && <p role="alert" className="text-sm text-red-700">{estado.erro}</p>}
      <button type="button" disabled={!estado.podeEmitir} onClick={aoEmitir} className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{textoBotao}</button>
    </aside>
  );
}
