"use client";

import React, { useMemo, useState } from "react";
import type { CortesiaResumo } from "@essencia/shared/types";
import { formatarNumeroIngresso } from "@essencia/shared/eventos/ingresso";
import { DialogoCancelar } from "./dialogo-cancelar";

interface SessaoLista { id: string; startsAt: string; apta: boolean }
interface ListaCortesiasProps { cortesias: CortesiaResumo[]; sessoes: SessaoLista[]; aoCompartilhar(cortesia: CortesiaResumo): Promise<void>; aoCompartilharAgrupadas(cortesias: CortesiaResumo[]): Promise<void>; aoCancelar(cortesia: CortesiaResumo, motivo: string): Promise<void> }

function normalizar(valor: string): string { return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(); }
function rotuloSituacao(situacao: CortesiaResumo["situacao"]): string { return situacao === "ATIVA" ? "Ativa" : situacao === "USADA" ? "Usada" : "Cancelada"; }
function dataSessao(inicio: Date | string): string {
  const partes = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(inicio)).map(({ type, value }) => [type, value]));
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

export function ListaCortesias({ cortesias, sessoes, aoCompartilhar, aoCompartilharAgrupadas, aoCancelar }: ListaCortesiasProps): React.JSX.Element {
  const [busca, setBusca] = useState("");
  const [sessao, setSessao] = useState("");
  const [selecionada, setSelecionada] = useState<CortesiaResumo | null>(null);
  const [compartilhando, setCompartilhando] = useState<ReadonlySet<string>>(new Set());
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  async function compartilhar(cortesia: CortesiaResumo): Promise<void> {
    setErroPdf(null);
    setCompartilhando((atual) => new Set(atual).add(cortesia.orderId));
    try { await aoCompartilhar(cortesia); }
    catch { setErroPdf("Não foi possível gerar o PDF."); }
    finally { setCompartilhando((atual) => { const proximo = new Set(atual); proximo.delete(cortesia.orderId); return proximo; }); }
  }
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set());
  const [compartilhandoLote, setCompartilhandoLote] = useState(false);
  // Só entram no lote as cortesias que ainda existem e não foram canceladas.
  const escolhidas = useMemo(() => cortesias.filter((cortesia) => marcadas.has(cortesia.orderId) && cortesia.situacao !== "CANCELADA"), [cortesias, marcadas]);
  function alternar(orderId: string): void {
    setMarcadas((atual) => { const proximo = new Set(atual); if (proximo.has(orderId)) proximo.delete(orderId); else proximo.add(orderId); return proximo; });
  }
  async function compartilharLote(): Promise<void> {
    setErroPdf(null);
    setCompartilhandoLote(true);
    try { await aoCompartilharAgrupadas(escolhidas); }
    catch { setErroPdf("Não foi possível gerar o PDF."); }
    finally { setCompartilhandoLote(false); }
  }
  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return cortesias.filter((cortesia) => (!sessao || cortesia.session.id === sessao) && (!termo || normalizar(`${cortesia.grupo} ${cortesia.participantName}`).includes(termo)));
  }, [busca, cortesias, sessao]);
  const selecionaveis = filtradas.filter((cortesia) => cortesia.situacao !== "CANCELADA");
  const todasMarcadas = selecionaveis.length > 0 && selecionaveis.every((cortesia) => marcadas.has(cortesia.orderId));
  function alternarTodas(): void {
    setMarcadas((atual) => {
      const proximo = new Set(atual);
      for (const cortesia of selecionaveis) { if (todasMarcadas) proximo.delete(cortesia.orderId); else proximo.add(cortesia.orderId); }
      return proximo;
    });
  }
  if (cortesias.length === 0) return <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Nenhuma cortesia emitida neste evento</p>;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-slate-700">Buscar cortesias<input aria-label="Buscar cortesias" value={busca} onChange={(evento) => setBusca(evento.target.value)} className="mt-1 block rounded border border-slate-300 p-2" placeholder="Grupo ou participante" /></label>
        <label className="text-sm text-slate-700">Sessão<select aria-label="Filtrar por sessão" value={sessao} onChange={(evento) => setSessao(evento.target.value)} className="mt-1 block rounded border border-slate-300 p-2"><option value="">Todas as sessões</option>{sessoes.map((item) => <option key={item.id} value={item.id}>{dataSessao(new Date(item.startsAt))}</option>)}</select></label>
        <div className="flex items-end gap-2">
          <button type="button" disabled={escolhidas.length === 0 || compartilhandoLote} onClick={() => void compartilharLote()} aria-label="Compartilhar selecionadas em um único PDF" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{compartilhandoLote ? "Gerando PDF…" : `Compartilhar selecionadas (${escolhidas.length})`}</button>
          {escolhidas.length > 0 && !compartilhandoLote && <button type="button" onClick={() => setMarcadas(new Set())} className="px-2 py-2 text-sm text-slate-600 underline">Limpar seleção</button>}
        </div>
      </div>
      {filtradas.length === 0 ? <p className="text-sm text-slate-600">Nenhuma cortesia encontrada.</p> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="p-3"><label><span className="sr-only">Selecionar todas</span><input type="checkbox" checked={todasMarcadas} disabled={selecionaveis.length === 0} onChange={alternarTodas} /></label></th><th className="p-3">Sessão</th><th className="p-3">Assento</th><th className="p-3">Nome</th><th className="p-3">Grupo</th><th className="p-3">Número do ingresso</th><th className="p-3">Emitida por</th><th className="p-3">Data</th><th className="p-3">Situação</th><th className="p-3">Ações</th></tr></thead><tbody>{filtradas.map((cortesia) => <tr key={cortesia.orderId} className="border-b last:border-0"><td className="p-3"><input type="checkbox" aria-label={`Selecionar ${cortesia.participantName}`} checked={cortesia.situacao !== "CANCELADA" && marcadas.has(cortesia.orderId)} disabled={cortesia.situacao === "CANCELADA"} onChange={() => alternar(cortesia.orderId)} /></td><td className="p-3">{dataSessao(cortesia.session.startsAt)}</td><td className="p-3">Fileira {cortesia.rowLabel} · Assento {cortesia.seatNumber}</td><td className="p-3">{cortesia.participantName}</td><td className="p-3">{cortesia.grupo}</td><td className="p-3">{formatarNumeroIngresso(cortesia.numero)}</td><td className="p-3">{cortesia.emitidaPor}</td><td className="p-3">{dataSessao(cortesia.emitidaEm)}</td><td className="p-3">{rotuloSituacao(cortesia.situacao)}</td><td className="p-3"><div className="flex gap-2"><button type="button" disabled={cortesia.situacao === "CANCELADA" || compartilhando.has(cortesia.orderId)} onClick={() => void compartilhar(cortesia)} aria-label={`Compartilhar PDF ${cortesia.orderNumber}`} className="rounded border px-2 py-1 disabled:opacity-50">{compartilhando.has(cortesia.orderId) ? "Gerando PDF…" : "Compartilhar PDF"}</button><button type="button" disabled={cortesia.situacao !== "ATIVA"} onClick={() => setSelecionada(cortesia)} aria-label={`Cancelar ${cortesia.participantName}`} className="rounded border border-red-200 px-2 py-1 text-red-700 disabled:opacity-50">Cancelar</button></div></td></tr>)}</tbody></table></div>}
      {erroPdf && <p role="alert" className="text-sm text-red-700">{erroPdf}</p>}
      <DialogoCancelar cortesia={selecionada} aoConfirmar={async (motivo) => { if (selecionada) await aoCancelar(selecionada, motivo); setSelecionada(null); }} aoFechar={() => setSelecionada(null)} />
    </section>
  );
}
