"use client";

import React from "react";
import type { TravaMapa, VersaoMapaResumo } from "./api-mapas";

export interface VersoesMapaProps {
  versoes: VersaoMapaResumo[];
  trava: TravaMapa;
  ocupado: boolean;
  onEditar: (mapId: string) => void;
  onExcluir: (mapId: string) => void;
}

const BOTAO = "rounded-lg border border-[#e5e8df] bg-white px-3 py-1 text-xs text-[#24302c] disabled:cursor-not-allowed disabled:opacity-50";

function data(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(valor));
}

function situacao(versao: VersaoMapaResumo) {
  if (versao.status === "EM_REVISAO") return "Em conferência";
  if (versao.atual) return "Atual";
  return versao.status === "CONFIRMADO" ? "Publicada" : "Arquivada";
}

function quantidadeLugares(lugares: number) {
  return `${lugares} ${lugares === 1 ? "lugar" : "lugares"}`;
}

export function VersoesMapa({ versoes, trava, ocupado, onEditar, onExcluir }: VersoesMapaProps) {
  const bloqueado = ocupado || trava.tipo !== "LIVRE";
  return (
    <div className="space-y-3" aria-label="Versões do mapa">
      {trava.mensagem ? <p role="alert" className="rounded-xl border border-[#f0d9a8] bg-[#fff8e8] px-3 py-2 text-sm text-[#7b591b]">{trava.mensagem}</p> : null}
      {versoes.length === 0 ? <p className="text-sm text-[#69736e]">Nenhuma versão de mapa enviada.</p> : null}
      {versoes.map((versao) => (
        <article key={versao.id} className="rounded-xl border border-[#e5e8df] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-semibold">Versão {versao.version}</h2>
              <p className="text-sm text-[#69736e]">{versao.originalFileName ?? "Arquivo não informado"}</p>
              <p className="text-xs text-[#69736e]">{quantidadeLugares(versao.lugares)}</p>
            </div>
            <span className="rounded-full bg-[#edf4df] px-2 py-1 text-xs font-semibold text-[#426021]">{situacao(versao)}</span>
          </div>
          {versao.sessoes.length > 0 ? (
            <p className="mt-2 text-xs text-[#69736e]">Sessões: {versao.sessoes.map((sessao) => data(sessao.startsAt)).join(", ")}</p>
          ) : <p className="mt-2 text-xs text-[#69736e]">Nenhuma sessão usa esta versão.</p>}
          <div className="mt-3 flex gap-2">
            {versao.editavel ? <button type="button" className={BOTAO} disabled={bloqueado} onClick={() => onEditar(versao.id)}>Editar versão {versao.version}</button> : null}
            {!versao.atual ? <button type="button" className={BOTAO} disabled={bloqueado} onClick={() => onExcluir(versao.id)}>Excluir versão {versao.version}</button> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
