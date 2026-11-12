"use client";

import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CortesiaResumo, MapaAdminSessao } from "@essencia/shared/types";
import { MapaEstiloB } from "@essencia/components/eventos/mapa-estilo-b";
import { dimensoesDoMapa, elementosDoMapa, paraLugaresPublicos, rotulosDoMapa } from "@essencia/components/eventos/adaptar-mapa";
import { obterMapaAdmin } from "./api-cortesias";
import { PainelLote } from "./painel-lote";
import { useEmissaoCortesias } from "./use-emissao-cortesias";

export interface SessaoCortesia { id: string; startsAt: string; apta: boolean }

interface EmitirCortesiasProps {
  eventId: string;
  sessoes: SessaoCortesia[];
  /** Muda quando algo fora da emissão (ex.: um cancelamento) altera a ocupação: recarrega o mapa. */
  versaoMapa?: number;
  aoEmitir: (emitidas: CortesiaResumo[]) => void;
}

function formatarSessao(inicio: string): string {
  const data = new Date(inicio);
  return Number.isNaN(data.getTime()) ? inicio : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function EmitirCortesias({ eventId, sessoes, versaoMapa = 0, aoEmitir: aoEmitirPai }: EmitirCortesiasProps): React.JSX.Element {
  const sessoesAptas = useMemo(() => sessoes.filter((sessao) => sessao.apta), [sessoes]);
  const [sessionId, setSessionId] = useState<string | null>(sessoesAptas[0]?.id ?? null);
  const [mapa, setMapa] = useState<MapaAdminSessao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroMapa, setErroMapa] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  useEffect(() => {
    const primeira = sessoesAptas[0]?.id ?? null;
    if (!sessionId || !sessoesAptas.some((sessao) => sessao.id === sessionId)) setSessionId(primeira);
  }, [sessionId, sessoesAptas]);

  const carregarMapa = useCallback(async (id: string | null) => {
    if (!id) { setMapa(null); return; }
    setCarregando(true);
    setErroMapa(null);
    try { setMapa(await obterMapaAdmin(eventId, id)); }
    catch { setMapa(null); setErroMapa("Não foi possível carregar o mapa desta sessão."); }
    finally { setCarregando(false); }
  }, [eventId]);

  useEffect(() => { void carregarMapa(sessionId); }, [carregarMapa, sessionId, versaoMapa]);

  const aoEmitir = useCallback((emitidas: CortesiaResumo[]) => {
    setMensagemSucesso(`${emitidas.length} ${emitidas.length === 1 ? "cortesia" : "cortesias"} emitida${emitidas.length === 1 ? "" : "s"}.`);
    aoEmitirPai(emitidas);
    void carregarMapa(sessionId);
  }, [aoEmitirPai, carregarMapa, sessionId]);

  const estado = useEmissaoCortesias({ eventId, sessionId, mapa, aoEmitir });
  useEffect(() => {
    if (estado.erro?.startsWith("Estes lugares não estão mais livres")) void carregarMapa(sessionId);
  }, [carregarMapa, estado.erro, sessionId]);
  const indisponiveis = useMemo(() => new Set(mapa?.seats.filter((seat) => seat.state !== "available").map((seat) => seat.id) ?? []), [mapa]);
  const lugares = useMemo(() => mapa ? paraLugaresPublicos(mapa, indisponiveis) : [], [indisponiveis, mapa]);
  const assentosSelecionados = useMemo(() => {
    if (!mapa) return [];
    return estado.selecionados.flatMap((seatId) => {
      const seat = mapa.seats.find((item) => item.id === seatId);
      return seat ? [{ seatId, rotulo: `Fileira ${seat.rowLabel} · Assento ${seat.seatNumber}`, nome: estado.nomes[seatId] ?? "", conflito: estado.conflitos.has(seatId) }] : [];
    });
  }, [estado.conflitos, estado.nomes, estado.selecionados, mapa]);

  if (sessoesAptas.length === 0) return <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Este evento ainda não tem sessão com mapa confirmado.</p>;
  const dimensoes = mapa ? dimensoesDoMapa(mapa) : { largura: 1, altura: 1 };
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm font-medium text-slate-700">Sessão
          <select aria-label="Sessão" value={sessionId ?? ""} onChange={(evento) => { setMensagemSucesso(null); setSessionId(evento.target.value); }} className="mt-1 block rounded-lg border border-slate-300 p-2">
            {sessoes.map((sessao) => <option key={sessao.id} value={sessao.id} disabled={!sessao.apta}>{formatarSessao(sessao.startsAt)}{sessao.apta ? "" : " — Confirme o mapa desta sessão para emitir cortesias"}</option>)}
          </select>
        </label>
        {mensagemSucesso && <p role="status" className="text-sm text-emerald-700">{mensagemSucesso}</p>}
      </div>
      {carregando && <p role="status">Carregando mapa…</p>}
      {erroMapa && <p role="alert" className="text-sm text-red-700">{erroMapa}</p>}
      {mapa && !carregando && <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
          <MapaEstiloB largura={dimensoes.largura} altura={dimensoes.altura} lugares={lugares} rotulos={rotulosDoMapa(mapa)} elementos={elementosDoMapa(mapa)} rotuloAcessivel="Mapa de assentos para cortesias" selecionados={new Set(estado.selecionados)} destacados={estado.conflitos} lugarDesabilitado={(lugar) => !lugares.find((item) => item.id === lugar.id)?.livre} rotuloDoLugar={(lugar) => `Fileira ${lugar.fileira} · Assento ${lugar.numero}`} onLugarClick={(id) => { if (!indisponiveis.has(id)) estado.alternar(id); }} />
        </div>
        <PainelLote assentos={assentosSelecionados} estado={estado} aoRemover={estado.remover} aoDefinirNome={estado.definirNome} aoDefinirCampo={estado.definirCampo} aoEmitir={() => setConfirmando(true)} />
      </div>}
      {confirmando && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h2 className="text-lg font-semibold">Emitir cortesias?</h2><p className="mt-2 text-sm text-slate-700">{estado.selecionados.length} assento(s) para {estado.grupo}. Os lugares ficam indisponíveis para venda.</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-lg border border-slate-300 px-4 py-2" onClick={() => setConfirmando(false)}>Voltar</button><button type="button" className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white" onClick={async () => { setConfirmando(false); await estado.emitir(); }}>Emitir</button></div></div></div>}
    </section>
  );
}
