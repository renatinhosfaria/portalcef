"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@essencia/ui/components/sheet";
import type { PublicEventDetail, PublicEventSession, PublicMap } from "@essencia/shared/types";
import { EventosApiError, reservarAssentos } from "../../lib/eventos-api";
import { calcularPrecoSelecao, serializarSelecaoAssentos, type AssentoSelecionado } from "../../lib/selecao-lugares";
import { EtapasCompra } from "../base/etapas-compra";
import { MapaPublico } from "../mapa/mapa-publico";
import { FaixaEvento } from "./faixa-evento";
import { ListaLugares } from "./lista-lugares";
import { faltaTipoIngresso, ResumoLugares } from "./resumo-lugares";
import { lugaresPerdidos, useDisponibilidadeAoVivo } from "./use-disponibilidade-ao-vivo";

const LIMITE_LUGARES = 20;

function podeVibrar(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function" && !(typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function normalizarSelecao(map: PublicMap, initial: AssentoSelecionado[], unavailableSeatIds: string[] = []): AssentoSelecionado[] {
  const seats = new Map(map.seats.map((seat) => [seat.id, seat]));
  const indisponiveis = new Set(unavailableSeatIds);
  return initial.flatMap((item) => {
    const seat = seats.get(item.seatId);
    if (!seat || seat.state !== "available" || indisponiveis.has(item.seatId)) return [];
    return [{ ...item, label: item.label ?? `${seat.rowLabel}${seat.seatNumber}`, accessible: item.accessible ?? seat.accessible }];
  }).slice(0, LIMITE_LUGARES);
}

export function EscolhaLugares({ evento, sessao, map: mapaInicial, initialSelection = [], unavailableSeatIds: indisponiveisIniciais = [], initialSelectionInvalid = false }: { evento: PublicEventDetail; sessao: PublicEventSession; map: PublicMap; initialSelection?: AssentoSelecionado[]; unavailableSeatIds?: string[]; initialSelectionInvalid?: boolean }): React.JSX.Element {
  const router = useRouter();
  const { mapa: map, atualizarAgora } = useDisponibilidadeAoVivo(sessao.id, mapaInicial);
  const [selection, setSelection] = useState(() => normalizarSelecao(mapaInicial, initialSelection, indisponiveisIniciais));
  const [unavailableSeatIds, setUnavailableSeatIds] = useState<string[]>(indisponiveisIniciais);
  const [selectionInvalid, setSelectionInvalid] = useState(initialSelectionInvalid);
  const [limitReached, setLimitReached] = useState(initialSelection.length > LIMITE_LUGARES);
  const [modoLista, setModoLista] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [conflictMessages, setConflictMessages] = useState<string[]>(() => indisponiveisIniciais.flatMap((seatId) => { const seat = mapaInicial.seats.find((item) => item.id === seatId); return seat ? [`O lugar ${seat.rowLabel}${seat.seatNumber} acabou de ser escolhido por outra pessoa`] : []; }));
  const [reservationError, setReservationError] = useState<string | null>(null);
  const selecionados = useMemo(() => new Set(selection.map((item) => item.seatId)), [selection]);
  const indisponiveis = useMemo(() => new Set(unavailableSeatIds), [unavailableSeatIds]);
  const tiposCompletos = selection.length > 0 && !faltaTipoIngresso(selection, sessao.ticketTypes);
  const preco = useMemo(() => calcularPrecoSelecao(selection, sessao.ticketTypes, sessao.offers).totalCents, [selection, sessao.ticketTypes, sessao.offers]);
  const resumo = <ResumoLugares selection={selection} ticketTypes={sessao.ticketTypes} offers={sessao.offers} onChangeTicketType={(seatId, ticketTypeId) => { setSelectionInvalid(false); setSelection((current) => current.map((item) => item.seatId === seatId ? { ...item, ticketTypeId } : item)); }} />;

  useEffect(() => {
    const perdidos = lugaresPerdidos(selection, map);
    const assentosNoMapa = new Set(map.seats.map((seat) => seat.id));
    const idsPerdidos = new Set([...perdidos.map((seat) => seat.id), ...selection.filter((item) => !assentosNoMapa.has(item.seatId)).map((item) => item.seatId)]);
    if (!idsPerdidos.size) return;
    const perdidosPorId = new Map(perdidos.map((seat) => [seat.id, seat]));
    const mensagens = selection.filter((item) => idsPerdidos.has(item.seatId)).map((item) => {
      const seat = perdidosPorId.get(item.seatId);
      return `O lugar ${item.label ?? `${seat?.rowLabel ?? ""}${seat?.seatNumber ?? item.seatId}`} acabou de ser escolhido por outra pessoa`;
    });
    setUnavailableSeatIds((current) => [...new Set([...current, ...idsPerdidos])]);
    setSelection((current) => current.filter((item) => !idsPerdidos.has(item.seatId)));
    setConflictMessages(mensagens);
  }, [map, selection]);

  function vibrarAoMarcar(): void { if (podeVibrar()) navigator.vibrate?.(10); }

  function alternar(seatId: string): void {
    if (reserving) return;
    const seat = map.seats.find((item) => item.id === seatId);
    if (!seat || seat.state !== "available" || indisponiveis.has(seat.id)) return;
    if (!selecionados.has(seat.id) && selection.length >= LIMITE_LUGARES) { setLimitReached(true); return; }
    setLimitReached(false);
    setSelectionInvalid(false);
    if (selecionados.has(seat.id)) { setSelection((current) => current.filter((item) => item.seatId !== seat.id)); return; }
    const ticketTypeId = sessao.ticketTypes.length === 1 ? sessao.ticketTypes[0]?.id ?? "" : "";
    setSelection((current) => [...current, { seatId: seat.id, ticketTypeId, label: `${seat.rowLabel}${seat.seatNumber}`, accessible: seat.accessible }]);
    vibrarAoMarcar();
  }

  async function continuar(): Promise<void> {
    if (!tiposCompletos || reserving || selectionInvalid) return;
    setReserving(true);
    setConflictMessages([]);
    setReservationError(null);
    try {
      const result = await reservarAssentos({ sessionId: sessao.id, seats: selection.map((item, participantIndex) => ({ seatId: item.seatId, ticketTypeId: item.ticketTypeId, participantIndex })) });
      router.push(`/checkout?pedido=${encodeURIComponent(result.orderNumber)}&slug=${encodeURIComponent(evento.slug)}&sessionId=${encodeURIComponent(sessao.id)}`);
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

  const query = selection.length && tiposCompletos ? `?${serializarSelecaoAssentos(selection)}&sessionId=${encodeURIComponent(sessao.id)}` : "";
  return <div className="content-width py-6 pb-28 md:py-8 md:pb-10">
    <FaixaEvento evento={evento} sessao={sessao} />
    <div className="mt-4"><EtapasCompra atual={1} /></div>
    {selectionInvalid && <p role="alert" className="mt-4 rounded-xl border border-[#f3d28b] bg-[#fff8e8] p-3 text-sm text-[#7a5200]">Não foi possível restaurar todos os lugares informados. Revise a seleção antes de continuar.</p>}
    {conflictMessages.length > 0 && <div aria-live="polite" className="sr-only">{conflictMessages.map((message) => <p key={message}>{message}</p>)}</div>}
    {reservationError && <div role="alert" aria-live="polite" className="mt-4 rounded-xl border border-[#efb4b4] bg-[#fff1f1] p-3 text-sm text-[#8b1e1e]"><p>{reservationError}</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => void continuar()} className="min-h-10 rounded-lg bg-[#8b1e1e] px-3 py-2 font-semibold text-white">Tentar novamente</button><a href={`/evento/${encodeURIComponent(evento.slug)}/sessao/${encodeURIComponent(sessao.id)}`} className="inline-flex min-h-10 items-center rounded-lg border border-[#d9a3a3] px-3 py-2 font-semibold">Voltar aos lugares</a></div></div>}
    {limitReached && <p role="status" aria-live="assertive" className="mt-4 rounded-xl border border-[#f3d28b] bg-[#fff8e8] p-3 text-sm text-[#7a5200]">Você pode selecionar no máximo 20 lugares por pedido.</p>}
    <div className="mt-6 flex items-center justify-between gap-3"><div><h1 className="font-display text-3xl font-semibold text-[#1f2a24]">Escolha seus lugares</h1><p className="mt-1 text-sm text-[#647066]">Toque em um lugar livre para adicioná-lo à sua seleção.</p></div><button type="button" onClick={() => setModoLista((atual) => !atual)} className="min-h-11 rounded-xl border border-[#d9ddcf] bg-white px-3 text-sm font-semibold text-[#3f6f12]">{modoLista ? "Ver mapa" : "Ver lugares em lista"}</button></div>
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0">{modoLista ? <ListaLugares map={map} selecionados={selecionados} indisponiveis={indisponiveis} onAlternar={alternar} /> : <MapaPublico map={map} selecionados={selecionados} indisponiveis={indisponiveis} onAlternar={alternar} />}</div>
      <aside className="hidden lg:sticky lg:top-6 lg:block lg:self-start">{resumo}<button type="button" disabled={!tiposCompletos || reserving || selectionInvalid} onClick={continuar} className="mt-4 min-h-12 w-full rounded-xl bg-[#3f6f12] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#c9cdc6]">{reserving ? "Guardando seus lugares…" : "Continuar"}</button>{query ? <span className="sr-only">{query}</span> : null}</aside>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e6e9e1] bg-white/95 p-3 shadow-lg backdrop-blur lg:hidden"><div className="mx-auto flex max-w-2xl items-center justify-between gap-3"><button type="button" onClick={() => setSheetOpen(true)} className="min-w-0 text-left"><span className="block truncate text-sm font-semibold text-[#1f2a24]">{selection.length} {selection.length === 1 ? "lugar" : "lugares"}{selection.length ? ` · ${selection.map((item) => item.label).join(", ")}` : ""}</span><span className="text-sm text-[#647066]">{(preco / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ")}</span></button><button type="button" disabled={!tiposCompletos || reserving || selectionInvalid} onClick={continuar} className="min-h-11 shrink-0 rounded-xl bg-[#3f6f12] px-4 py-2 text-sm font-semibold text-white disabled:bg-[#c9cdc6]">{reserving ? "Guardando seus lugares…" : "Continuar"}</button></div></div>
    <Sheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Resumo dos lugares"><div>{resumo}<button type="button" disabled={!tiposCompletos || reserving || selectionInvalid} onClick={continuar} className="mt-4 min-h-12 w-full rounded-xl bg-[#3f6f12] px-4 py-3 text-sm font-semibold text-white disabled:bg-[#c9cdc6]">{reserving ? "Guardando seus lugares…" : "Continuar"}</button></div></Sheet>
  </div>;
}
