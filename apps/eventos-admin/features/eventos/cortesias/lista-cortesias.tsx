"use client";

import React, { useMemo, useState } from "react";
import type { CortesiaResumo } from "@essencia/shared/types";
import { DialogoCancelar } from "./dialogo-cancelar";

interface SessaoLista { id: string; startsAt: string; apta: boolean }
interface ListaCortesiasProps { cortesias: CortesiaResumo[]; sessoes: SessaoLista[]; aoBaixar(cortesia: CortesiaResumo): Promise<void>; aoCancelar(cortesia: CortesiaResumo, motivo: string): Promise<void> }

function normalizar(valor: string): string { return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(); }
function rotuloSituacao(situacao: CortesiaResumo["situacao"]): string { return situacao === "ATIVA" ? "Ativa" : situacao === "USADA" ? "Usada" : "Cancelada"; }
function dataSessao(inicio: Date): string { return new Date(inicio).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }

export function ListaCortesias({ cortesias, sessoes, aoBaixar, aoCancelar }: ListaCortesiasProps): React.JSX.Element {
  const [busca, setBusca] = useState("");
  const [sessao, setSessao] = useState("");
  const [selecionada, setSelecionada] = useState<CortesiaResumo | null>(null);
  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return cortesias.filter((cortesia) => (!sessao || cortesia.session.id === sessao) && (!termo || normalizar(`${cortesia.grupo} ${cortesia.participantName}`).includes(termo)));
  }, [busca, cortesias, sessao]);
  if (cortesias.length === 0) return <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Nenhuma cortesia emitida neste evento</p>;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-slate-700">Buscar cortesias<input aria-label="Buscar cortesias" value={busca} onChange={(evento) => setBusca(evento.target.value)} className="mt-1 block rounded border border-slate-300 p-2" placeholder="Grupo ou participante" /></label>
        <label className="text-sm text-slate-700">Sessão<select aria-label="Filtrar por sessão" value={sessao} onChange={(evento) => setSessao(evento.target.value)} className="mt-1 block rounded border border-slate-300 p-2"><option value="">Todas as sessões</option>{sessoes.map((item) => <option key={item.id} value={item.id}>{dataSessao(new Date(item.startsAt))}</option>)}</select></label>
      </div>
      {filtradas.length === 0 ? <p className="text-sm text-slate-600">Nenhuma cortesia encontrada.</p> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="p-3">Assento</th><th className="p-3">Participante</th><th className="p-3">Grupo</th><th className="p-3">Sessão</th><th className="p-3">Situação</th><th className="p-3">Ações</th></tr></thead><tbody>{filtradas.map((cortesia) => <tr key={cortesia.orderId} className="border-b last:border-0"><td className="p-3">Fileira {cortesia.rowLabel} · Assento {cortesia.seatNumber}</td><td className="p-3">{cortesia.participantName}</td><td className="p-3">{cortesia.grupo}</td><td className="p-3">{dataSessao(cortesia.session.startsAt)}</td><td className="p-3">{rotuloSituacao(cortesia.situacao)}</td><td className="flex gap-2 p-3"><button type="button" disabled={cortesia.situacao === "CANCELADA"} onClick={() => void aoBaixar(cortesia)} aria-label={`Baixar PDF ${cortesia.orderNumber}`} className="rounded border px-2 py-1 disabled:opacity-50">Baixar PDF</button><button type="button" disabled={cortesia.situacao !== "ATIVA"} onClick={() => setSelecionada(cortesia)} aria-label={`Cancelar ${cortesia.participantName}`} className="rounded border border-red-200 px-2 py-1 text-red-700 disabled:opacity-50">Cancelar</button></td></tr>)}</tbody></table></div>}
      <DialogoCancelar cortesia={selecionada} aoConfirmar={async (motivo) => { if (selecionada) await aoCancelar(selecionada, motivo); setSelecionada(null); }} aoFechar={() => setSelecionada(null)} />
    </section>
  );
}
