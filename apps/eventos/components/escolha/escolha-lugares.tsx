"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PedidoPublicoResult, PublicEventDetail, PublicEventSession, PublicMap } from "@essencia/shared/types";
import { assinaturaComposicaoPacotes } from "@essencia/shared/eventos/pacotes";
import { adicionarPacote, desfazerPacote, removerAssentos, selecaoCompleta } from "../../lib/composicao-pacotes";
import { EventosApiError, consultarPedido, liberarPedido, reservarAssentos } from "../../lib/eventos-api";
import { lerRascunhoSelecao, salvarRascunhoSelecao } from "../../lib/rascunho-selecao";
import { calcularPrecoSelecao, type AssentoSelecionado } from "../../lib/selecao-lugares";
import { ResumoPedido } from "../checkout/resumo-pedido";
import { EtapasCompra } from "../base/etapas-compra";
import { MapaPublico } from "../mapa/mapa-publico";
import { FaixaEvento } from "./faixa-evento";
import { ListaLugares } from "./lista-lugares";
import { ResumoLugares } from "./resumo-lugares";
import { lugaresPerdidos, useDisponibilidadeAoVivo } from "./use-disponibilidade-ao-vivo";



const IDS_VAZIOS: string[] = [];

function podeVibrar(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function" && !(typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function normalizarSelecao(map: PublicMap, initial: AssentoSelecionado[], unavailableSeatIds: string[] = [], tipos: PublicEventSession["ticketTypes"] = []): AssentoSelecionado[] {
  const seats = new Map(map.seats.map((seat) => [seat.id, seat]));
  const indisponiveis = new Set(unavailableSeatIds);
  const perdidos = initial.filter(item => !seats.has(item.seatId) || seats.get(item.seatId)?.state !== "available" || indisponiveis.has(item.seatId)).map(item => item.seatId);
  let recuperados = removerAssentos(initial, perdidos);
  const porTipo = new Map(tipos.map(tipo => [tipo.id, tipo]));
  const grupos = new Map<string, AssentoSelecionado[]>();
  for (const item of recuperados) if (item.pacoteId) grupos.set(item.pacoteId, [...(grupos.get(item.pacoteId) ?? []), item]);
  for (const [id, grupo] of grupos) {
    const tipo = porTipo.get(grupo[0]!.ticketTypeId);
    if (!tipo || (tipo.lugaresPorPacote ?? 1) <= 1 || grupo.length !== tipo.lugaresPorPacote || grupo.some(item => item.ticketTypeId !== tipo.id)) recuperados = desfazerPacote(recuperados, id);
  }
  return recuperados.flatMap((item) => {
    const seat = seats.get(item.seatId);
    if (!seat || seat.state !== "available" || indisponiveis.has(item.seatId)) return [];
    const tipo = porTipo.get(item.ticketTypeId);
    return [{ ...item, ticketTypeId: !tipo || ((tipo.lugaresPorPacote ?? 1) > 1 && !item.pacoteId) ? "" : item.ticketTypeId, label: item.label ?? `${seat.rowLabel}${seat.seatNumber}`, accessible: item.accessible ?? seat.accessible }];
  });
}

export function EscolhaLugares({ evento, sessao, map: mapaInicial, initialSelection = [], unavailableSeatIds: indisponiveisIniciais = IDS_VAZIOS, initialSelectionInvalid = false, rascunhoId, pedidoRetomada }: { evento: PublicEventDetail; sessao: PublicEventSession; map: PublicMap; initialSelection?: AssentoSelecionado[]; unavailableSeatIds?: string[]; initialSelectionInvalid?: boolean; rascunhoId?: string; pedidoRetomada?: string }): React.JSX.Element {
  const router = useRouter();
  const { mapa: map, atualizarAgora } = useDisponibilidadeAoVivo(sessao.id, mapaInicial);
  const [selection, setSelection] = useState(() => normalizarSelecao(mapaInicial, initialSelection, indisponiveisIniciais, sessao.ticketTypes));
  const [unavailableSeatIds, setUnavailableSeatIds] = useState<string[]>(indisponiveisIniciais);
  const rascunhoIdRef = useRef(rascunhoId);
  const ultimaRestauracaoRef = useRef<string | undefined>(undefined);
  const pularGravacaoRef = useRef(false);
  const [restaurando, setRestaurando] = useState(Boolean(rascunhoId));
  const [selectionInvalid, setSelectionInvalid] = useState(initialSelectionInvalid);
  const [reservaRetomada, setReservaRetomada] = useState<PedidoPublicoResult | null>(null);
  const [reservaLiberada, setReservaLiberada] = useState(false);
  const [tentativaRestauracao, setTentativaRestauracao] = useState(0);
  const [erroRestauracao, setErroRestauracao] = useState(false);
  const [modoLista, setModoLista] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [conflictMessages, setConflictMessages] = useState<string[]>(() => indisponiveisIniciais.flatMap((seatId) => { const seat = mapaInicial.seats.find((item) => item.id === seatId); return seat ? [`O lugar ${seat.rowLabel}${seat.seatNumber} acabou de ser escolhido por outra pessoa`] : []; }));
  const [reservationError, setReservationError] = useState<string | null>(null);
  const selecionados = useMemo(() => new Set(selection.map((item) => item.seatId)), [selection]);
  const indisponiveis = useMemo(() => new Set(unavailableSeatIds), [unavailableSeatIds]);
  const tiposCompletos = !restaurando && !erroRestauracao && !reservaLiberada && (Boolean(reservaRetomada) || selecaoCompleta(selection, sessao.ticketTypes));
  const faltaTipo = selection.length > 0 && !tiposCompletos;
  const preco = useMemo(() => calcularPrecoSelecao(selection, sessao.ticketTypes, sessao.offers).totalCents, [selection, sessao.ticketTypes, sessao.offers]);
  const resumo = reservaRetomada ? <ResumoPedido pedido={reservaRetomada} evento={evento} sessao={sessao} permitirCupom={false} alterando={reserving} onAlterar={() => void alterarReserva()} /> : <ResumoLugares selection={selection} ticketTypes={sessao.ticketTypes} offers={sessao.offers} onAdicionarPacote={(tipoId) => { setSelectionInvalid(false); setSelection(current => adicionarPacote(current, sessao.ticketTypes, tipoId, globalThis.crypto.randomUUID())); }} onDesfazerPacote={(id) => { setSelectionInvalid(false); setSelection(current => desfazerPacote(current, id)); }} onChangeTicketType={(seatId, ticketTypeId) => { setSelectionInvalid(false); setSelection((current) => current.map((item) => item.seatId === seatId ? { ...item, ticketTypeId } : item)); }} />;

  useEffect(() => {
    const chave = JSON.stringify([sessao.id, rascunhoId, pedidoRetomada, tentativaRestauracao]);
    if (!rascunhoId || ultimaRestauracaoRef.current === chave) return;
    ultimaRestauracaoRef.current = chave;
    pularGravacaoRef.current = true;
    let cancelado = false;
    let concluido = false;
    setRestaurando(true);
    setErroRestauracao(false);
    setReservaRetomada(null);
    setReservaLiberada(false);
    const salvo = lerRascunhoSelecao(rascunhoId, sessao.id);
    async function restaurar(): Promise<void> {
      try {
        if (!salvo) { rascunhoIdRef.current = undefined; setSelectionInvalid(true); return; }
        rascunhoIdRef.current = rascunhoId;
        if (pedidoRetomada) {
          const pedido = await consultarPedido(pedidoRetomada);
          if (cancelado) return;
          const assinaturaSalva = assinaturaComposicaoPacotes(sessao.id, salvo.assentos.map((item, participantIndex) => ({ ...item, participantIndex })));
          const assinaturaPedido = assinaturaComposicaoPacotes(pedido.sessionId, pedido.items.map((item, index) => ({ seatId: item.seatId, ticketTypeId: item.ticketTypeId, participantIndex: item.participantIndex ?? index, pacoteId: item.pacote?.id })));
          if (assinaturaSalva === assinaturaPedido && ["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"].includes(pedido.status) && pedido.expiresAt && new Date(pedido.expiresAt).getTime() > Date.now()) {
            setReservaRetomada(pedido);
            setSelection(salvo.assentos);
            setSelectionInvalid(false);
            return;
          }
        }
        setReservaRetomada(null);
        const recuperados = normalizarSelecao(mapaInicial, salvo.assentos, indisponiveisIniciais, sessao.ticketTypes);
        setSelection(recuperados);
        setSelectionInvalid(recuperados.length !== salvo.assentos.length);
      } catch {
        if (!cancelado) {
          setErroRestauracao(true);
          setReservationError("Não foi possível consultar sua reserva. Tente novamente para retomar a compra com segurança.");
        }
      } finally {
        concluido = true;
        if (!cancelado) setRestaurando(false);
      }
    }
    void restaurar();
    return () => { cancelado = true; if (!concluido) ultimaRestauracaoRef.current = undefined; };
  }, [rascunhoId, pedidoRetomada, tentativaRestauracao, sessao.id, mapaInicial, indisponiveisIniciais, sessao.ticketTypes]);

  useEffect(() => {
    if (pularGravacaoRef.current) { pularGravacaoRef.current = false; return; }
    if (restaurando || selectionInvalid || erroRestauracao || reservaRetomada || !rascunhoIdRef.current) return;
    try { salvarRascunhoSelecao({ versao: 1, sessionId: sessao.id, assentos: selection }, rascunhoIdRef.current); }
    catch (error) { setReservationError(error instanceof Error ? error.message : "Não foi possível guardar a seleção."); }
  }, [selection, sessao.id, restaurando, selectionInvalid, erroRestauracao, reservaRetomada]);

  useEffect(() => {
    if (restaurando || reservaRetomada || erroRestauracao) return;
    const perdidos = lugaresPerdidos(selection, map);
    const assentosNoMapa = new Set(map.seats.map((seat) => seat.id));
    const idsPerdidos = new Set([...perdidos.map((seat) => seat.id), ...selection.filter((item) => !assentosNoMapa.has(item.seatId)).map((item) => item.seatId)]);
    if (!idsPerdidos.size) return;
    const perdidosPorId = new Map(perdidos.map((seat) => [seat.id, seat]));
    const mensagens = selection.filter((item) => idsPerdidos.has(item.seatId)).map((item) => {
      const seat = perdidosPorId.get(item.seatId);
      const rotulo = seat ? `${seat.rowLabel}${seat.seatNumber}` : item.label ?? item.seatId;
      return `O lugar ${rotulo} acabou de ser escolhido por outra pessoa`;
    });
    setUnavailableSeatIds((current) => [...new Set([...current, ...idsPerdidos])]);
    setSelection((current) => removerAssentos(current, [...idsPerdidos]));
    setConflictMessages(mensagens);
    setSelectionInvalid(true);
  }, [map, selection, restaurando, reservaRetomada, erroRestauracao]);

  function irParaResumo(): void { document.getElementById("resumo-lugares")?.scrollIntoView({ behavior: "smooth", block: "start" }); }

  function vibrarAoMarcar(): void { if (podeVibrar()) navigator.vibrate?.(10); }

  function alternar(seatId: string): void {
    if (reserving || restaurando || reservaRetomada || erroRestauracao) return;
    const seat = map.seats.find((item) => item.id === seatId);
    if (!seat || seat.state !== "available" || indisponiveis.has(seat.id)) return;
    setSelectionInvalid(false);
    if (selecionados.has(seat.id)) { setSelection((current) => removerAssentos(current, [seat.id])); return; }
    const avulsos = sessao.ticketTypes.filter(tipo => (tipo.lugaresPorPacote ?? 1) === 1);
    const ticketTypeId = avulsos.length === 1 ? avulsos[0]!.id : "";
    setSelection((current) => [...current, { seatId: seat.id, ticketTypeId, label: `${seat.rowLabel}${seat.seatNumber}`, accessible: seat.accessible }]);
    vibrarAoMarcar();
  }

  function abrirCheckout(orderNumber: string): void {
    router.push(`/checkout?pedido=${encodeURIComponent(orderNumber)}&slug=${encodeURIComponent(evento.slug)}&sessionId=${encodeURIComponent(sessao.id)}`);
  }

  async function alterarReserva(): Promise<void> {
    if (!reservaRetomada || reserving || restaurando || erroRestauracao) return;
    setReserving(true);
    setReservationError(null);
    try {
      rascunhoIdRef.current = salvarRascunhoSelecao({ versao: 1, sessionId: sessao.id, assentos: selection }, rascunhoIdRef.current);
      await liberarPedido(reservaRetomada.orderNumber);
      setReservaLiberada(true);
      const atualizado = await atualizarAgora();
      const recuperados = normalizarSelecao(atualizado, selection, [], sessao.ticketTypes);
      setSelection(recuperados);
      setSelectionInvalid(recuperados.length !== selection.length);
      setUnavailableSeatIds([]);
      const url = new URL(window.location.href);
      url.searchParams.delete("orderNumber");
      url.searchParams.delete("reservationId");
      url.searchParams.set("selecao", rascunhoIdRef.current);
      window.history.replaceState(window.history.state, "", url);
      setReservaRetomada(null);
      setReservaLiberada(false);
    } catch (error) {
      setReservationError(error instanceof Error ? error.message : "Não foi possível liberar sua reserva. Tente novamente.");
    } finally { setReserving(false); }
  }

  async function continuar(): Promise<void> {
    if (!tiposCompletos || reserving || selectionInvalid) return;
    if (reservaRetomada) { abrirCheckout(reservaRetomada.orderNumber); return; }
    setReserving(true);
    setConflictMessages([]);
    setReservationError(null);
    try {
      rascunhoIdRef.current = salvarRascunhoSelecao({ versao: 1, sessionId: sessao.id, assentos: selection }, rascunhoIdRef.current);
      const url = new URL(window.location.href);
      for (const nome of ["assentos", "ticketTypeIds", "ticketTypeId"]) url.searchParams.delete(nome);
      url.searchParams.set("selecao", rascunhoIdRef.current);
      window.history.replaceState(window.history.state, "", url);
      const result = await reservarAssentos({ sessionId: sessao.id, seats: selection.map((item, participantIndex) => ({ seatId: item.seatId, ticketTypeId: item.ticketTypeId, participantIndex, ...(item.pacoteId ? { pacoteId: item.pacoteId } : {}) })) });
      abrirCheckout(result.orderNumber);
    } catch (error) {
      if (error instanceof EventosApiError && error.status === 409 && error.code === "SEAT_UNAVAILABLE") {
        try {
          await atualizarAgora();
        } catch {
          setReservationError("Não foi possível atualizar a disponibilidade dos lugares. Tente novamente.");
        }
      } else {
        setReservationError(error instanceof EventosApiError && error.message ? error.message : "Não foi possível guardar seus lugares. Tente novamente.");
      }
    } finally { setReserving(false); }
  }

  return <div className="content-width py-6 pb-28 md:py-8 md:pb-10">
    <FaixaEvento evento={evento} sessao={sessao} />
    <div className="mt-4"><EtapasCompra atual={1} /></div>
    {selectionInvalid && <p role="alert" className="mt-4 rounded-xl border border-[#f3d28b] bg-[#fff8e8] p-3 text-sm text-[#7a5200]">Não foi possível restaurar todos os lugares informados. Revise a seleção antes de continuar. <button type="button" onClick={() => setSelectionInvalid(false)} className="ml-2 font-semibold underline">Confirmar seleção restante</button></p>}
    {reservaRetomada && <p role="status" className="mt-4 rounded-xl bg-[#f1f7e9] p-3">{reservaLiberada ? "Sua reserva foi liberada. Tente atualizar o mapa novamente para editar a seleção." : "Você já tem uma reserva ativa. Continue a compra ou altere os lugares para liberar a reserva."}</p>}
    {conflictMessages.length > 0 && <div aria-live="polite" className="sr-only">{conflictMessages.map((message) => <p key={message}>{message}</p>)}</div>}
    {reservationError && <div role="alert" aria-live="polite" className="mt-4 rounded-xl border border-[#efb4b4] bg-[#fff1f1] p-3 text-sm text-[#8b1e1e]"><p>{reservationError}</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => { if (erroRestauracao) { setReservationError(null); setTentativaRestauracao(n => n + 1); } else if (reservaRetomada) void alterarReserva(); else void continuar(); }} className="min-h-10 rounded-lg bg-[#8b1e1e] px-3 py-2 font-semibold text-white">Tentar novamente</button><a href={`/evento/${encodeURIComponent(evento.slug)}/sessao/${encodeURIComponent(sessao.id)}`} className="inline-flex min-h-10 items-center rounded-lg border border-[#d9a3a3] px-3 py-2 font-semibold">Voltar aos lugares</a></div></div>}
    <div className="mt-6 flex items-center justify-between gap-3"><div><h1 className="font-display text-3xl font-semibold text-[#1f2a24]">Escolha seus lugares</h1><p className="mt-1 text-sm text-[#647066]">Toque em um lugar livre para adicioná-lo à sua seleção.</p></div><button type="button" onClick={() => setModoLista((atual) => !atual)} className="min-h-11 rounded-xl border border-[#d9ddcf] bg-white px-3 text-sm font-semibold text-[#3f6f12]">{modoLista ? "Ver mapa" : "Ver lugares em lista"}</button></div>
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0">{modoLista ? <ListaLugares map={map} selecionados={selecionados} indisponiveis={indisponiveis} onAlternar={alternar} /> : <MapaPublico map={map} selecionados={selecionados} indisponiveis={indisponiveis} onAlternar={alternar} />}</div>
      <aside className="lg:sticky lg:top-6 lg:self-start">{resumo}<button type="button" disabled={!tiposCompletos || reserving || selectionInvalid} onClick={continuar} className="mt-4 hidden min-h-12 w-full rounded-xl bg-[#3f6f12] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#c9cdc6] lg:block">{reserving ? "Guardando seus lugares…" : reservaRetomada ? "Continuar compra" : "Continuar"}</button></aside>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e6e9e1] bg-white/95 p-3 shadow-lg backdrop-blur lg:hidden"><div className="mx-auto flex max-w-2xl items-center justify-between gap-3"><button type="button" onClick={irParaResumo} className="min-w-0 text-left"><span className="block truncate text-sm font-semibold text-[#1f2a24]">{selection.length} {selection.length === 1 ? "lugar" : "lugares"}{selection.length ? ` · ${selection.map((item) => item.label).join(", ")}` : ""}</span>{faltaTipo ? <span className="text-sm font-semibold text-[#9a6700]">{sessao.ticketTypes.some(tipo => (tipo.lugaresPorPacote ?? 1) > 1) ? "Escolha os ingressos ↓" : "Escolha Inteira ou Meia ↓"}</span> : <span className="text-sm text-[#647066]">{((reservaRetomada?.totalCents ?? preco) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ")}</span>}</button><button type="button" disabled={!tiposCompletos || reserving || selectionInvalid} onClick={continuar} className="min-h-11 shrink-0 rounded-xl bg-[#3f6f12] px-4 py-2 text-sm font-semibold text-white disabled:bg-[#c9cdc6]">{reserving ? "Guardando seus lugares…" : reservaRetomada ? "Continuar compra" : "Continuar"}</button></div></div>
  </div>;
}
