"use client";

import React, { useMemo, useRef, useState } from "react";
import type { OfertaPrecoPublica, PoliticaPublica, PedidoPublicoResult, PublicEventSession } from "@essencia/shared/types";
import { EventosApiError, finalizarPedido, gerarChaveIdempotenciaPublica, iniciarCheckout, origemPublicaEventos, reservarAssentos } from "../lib/eventos-api";
import { formatarDataPublica, formatarPrecoPublico } from "../lib/eventos-formatters";
import { calcularPrecoSelecao } from "./resumo-assentos";

const TIPOS_POLITICA: PoliticaPublica["type"][] = ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"];
const CODIGOS_PEDIDO_ENCERRADO = new Set(["ORDER_NOT_AVAILABLE", "ORDER_NOT_FOUND", "RESERVATION_EXPIRED", "RESERVATION_CANCELLED"]);

export function aceitesCompletos(acceptances: Array<{ type: PoliticaPublica["type"]; version: number }>) {
  return acceptances.length === TIPOS_POLITICA.length && new Set(acceptances.map((acceptance) => acceptance.type)).size === TIPOS_POLITICA.length && TIPOS_POLITICA.every((type) => acceptances.some((acceptance) => acceptance.type === type && Number.isInteger(acceptance.version) && acceptance.version > 0));
}

export function deveInvalidarChaveReserva(cause: unknown) {
  return cause instanceof EventosApiError && (CODIGOS_PEDIDO_ENCERRADO.has(cause.code ?? "") || cause.status === 404 || /expirad|cancelad/i.test(cause.message));
}

type Props = {
  seatIds: string[];
  ticketTypeIds?: string[];
  sessionId?: string;
  politicas?: PoliticaPublica[];
  event?: { title: string; startsAt: Date | string | null; locationName: string | null };
  session?: PublicEventSession;
  offers?: OfertaPrecoPublica[];
  mapHref?: string;
  onComplete?: (pedido: PedidoPublicoResult) => void;
};

export function FormularioCheckout({ seatIds, ticketTypeIds = [], sessionId, politicas = [], event, session, offers, mapHref, onComplete }: Props) {
  const reservationKeyRef = useRef<string | null>(null);
  if (!reservationKeyRef.current) reservationKeyRef.current = gerarChaveIdempotenciaPublica("reserva");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seatUnavailable, setSeatUnavailable] = useState(false);
  const [pending, setPending] = useState(false);
  const hasAllPolicies = useMemo(() => politicas.length === TIPOS_POLITICA.length && TIPOS_POLITICA.every((type) => accepted[type]), [accepted, politicas.length]);
  const hasSeats = seatIds.length > 0 && seatIds.every((seatId) => seatId.trim());
  const tiposPorAssento = useMemo(() => ticketTypeIds.length === seatIds.length ? ticketTypeIds : ticketTypeIds.length === 1 ? seatIds.map(() => ticketTypeIds[0]) : [], [seatIds, ticketTypeIds]);
  const hasTicketTypes = seatIds.length > 0 && tiposPorAssento.length === seatIds.length && tiposPorAssento.every(Boolean);
  const tiposDisponiveis = session?.ticketTypes ?? [];
  const ofertasDisponiveis = offers ?? session?.offers ?? [];
  const resumoSessao = session ? `${formatarDataPublica(session.startsAt, { hour: "2-digit", minute: "2-digit" })}${session.location?.name ? ` · ${session.location.name}` : ""}` : "Sessão selecionada";
  const rotulosAssentos = seatIds.map((seatId, index) => /^[\p{L}\d]+[- ]\d+$/u.test(seatId) ? seatId : `Assento ${index + 1}`);
  const preco = calcularPrecoSelecao(seatIds.map((seatId, index) => ({ seatId, ticketTypeId: tiposPorAssento[index] ?? "", label: rotulosAssentos[index] })), tiposDisponiveis, ofertasDisponiveis);
  const ofertaTexto = seatIds.length > 0
    ? ofertasDisponiveis.find((offer) => offer.discountPercent != null && (seatIds.length < offer.minQuantity || (seatIds.length >= offer.minQuantity && seatIds.length <= (offer.maxQuantity ?? Number.POSITIVE_INFINITY))))
    : undefined;

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSeatUnavailable(false);
    if (!hasSeats) return setError("Selecione ao menos um assento disponível.");
    if (!hasTicketTypes) return setError("Não foi possível identificar o tipo de ingresso selecionado.");
    if (!sessionId) return setError("Não foi possível identificar a sessão. Volte ao mapa e tente novamente.");
    if (!hasAllPolicies) return setError("Leia e aceite todas as políticas para continuar.");
    const form = new FormData(event.currentTarget);
    const buyer = { name: String(form.get("buyerName") || "").trim(), email: String(form.get("buyerEmail") || "").trim(), phone: String(form.get("buyerPhone") || "").trim() };
    if (buyer.name.length < 2 || !buyer.email || buyer.phone.length < 8) return setError("Preencha nome, e-mail e telefone do comprador.");
    const participants = seatIds.map((_, participantIndex) => ({ participantIndex, fullName: String(form.get(`participant-${participantIndex}-fullName`) || ""), type: "CONVIDADO" as const }));
    if (participants.some((participant) => participant.fullName.trim().length < 2)) return setError("Informe o nome de cada participante.");
    setSubmitting(true);
    let etapa: "reserva" | "finalizacao" | "checkout" = "reserva";
    try {
      const reservationKey = reservationKeyRef.current ?? gerarChaveIdempotenciaPublica("reserva");
      reservationKeyRef.current = reservationKey;
      const reservation = await reservarAssentos({ sessionId, idempotencyKey: reservationKey, seats: seatIds.map((seatId, index) => ({ seatId, ticketTypeId: tiposPorAssento[index] || "", participantIndex: index })), buyer });
      etapa = "finalizacao";
      const pedido = await finalizarPedido(reservation.orderNumber, { participants, acceptances: politicas.map((policy) => ({ type: policy.type, version: policy.version })) });
      setPending(true);
      onComplete?.(pedido);
      etapa = "checkout";
      const checkout = await iniciarCheckout(reservation.orderNumber, { successUrl: `${origemPublicaEventos()}/pedido/${encodeURIComponent(reservation.orderNumber)}?retorno=sucesso`, cancelUrl: `${origemPublicaEventos()}/pedido/${encodeURIComponent(reservation.orderNumber)}?retorno=cancelado` });
      if (typeof window !== "undefined") window.location.assign(checkout.checkoutUrl);
    } catch (cause) {
      if (etapa !== "checkout" && deveInvalidarChaveReserva(cause)) reservationKeyRef.current = null;
      setPending(false);
      setSeatUnavailable(cause instanceof EventosApiError && cause.code === "SEAT_UNAVAILABLE");
      if (cause instanceof EventosApiError && cause.status === 409) setError(cause.message);
      else if (cause instanceof EventosApiError && cause.status === 429) setError("Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.");
      else setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o pagamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pending) return <p role="status" className="rounded border border-amber-300 bg-amber-50 p-4">Pagamento pendente: aguardando confirmação do pagamento.</p>;

  return <form onSubmit={enviar} noValidate className="max-w-xl space-y-6 rounded-xl border bg-white p-6" aria-describedby={error ? "checkout-error" : undefined}>
    <section aria-label="Resumo da reserva" className="rounded-lg bg-slate-50 p-4">
      <h2 className="font-semibold">Resumo da reserva</h2>
      {event && <p className="text-sm font-medium text-slate-700">{event.title}</p>}
      <p className="text-sm text-slate-700">Sessão: {resumoSessao}</p>
      <p className="text-sm text-slate-700">Data: {event ? formatarDataPublica(event.startsAt) : "Data a confirmar"}</p>
      <p className="text-sm text-slate-700">Local: {event?.locationName ?? session?.location?.name ?? "Local a confirmar"}</p>
      {ofertaTexto?.discountPercent != null && <p className="mt-2 text-sm font-medium text-blue-700">{ofertaTexto.discountPercent}% de desconto a partir de {ofertaTexto.minQuantity} lugares</p>}
      <ul className="mt-2 space-y-1 text-sm text-slate-700">{seatIds.map((seatId, index) => {
        const tipo = tiposDisponiveis.find((item) => item.id === tiposPorAssento[index]);
        const nomeTipo = tipo?.name ?? "Ingresso selecionado";
        const preco = tipo ? ` · ${formatarPrecoPublico(tipo.priceCents).replace("A partir de ", "")}` : "";
        return <li key={`${seatId}-${index}`}>{rotulosAssentos[index]}: {nomeTipo}{preco}</li>;
      })}</ul>
      <dl className="mt-4 space-y-1 text-sm text-slate-700" aria-label="Prévia de preço">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatarPrecoPublico(preco.subtotalCents).replace("A partir de ", "")}</dd></div>
        <div className="flex justify-between"><dt>Desconto</dt><dd>{formatarPrecoPublico(preco.discountCents).replace("A partir de ", "")}</dd></div>
        <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatarPrecoPublico(preco.totalCents).replace("A partir de ", "")}</dd></div>
      </dl>
    </section>
    <fieldset className="space-y-3"><legend className="text-lg font-semibold">Dados do comprador</legend>
      <label className="block">Nome completo<input required minLength={2} name="buyerName" autoComplete="name" className="mt-1 w-full rounded border p-2" /></label>
      <label className="block">E-mail<input required type="email" name="buyerEmail" autoComplete="email" className="mt-1 w-full rounded border p-2" /></label>
      <label className="block">Telefone<input required minLength={8} name="buyerPhone" autoComplete="tel" className="mt-1 w-full rounded border p-2" /></label>
    </fieldset>
    <fieldset className="space-y-3"><legend className="text-lg font-semibold">Participantes</legend>
      {seatIds.map((seatId, index) => <label key={seatId} className="block">Nome do participante do {rotulosAssentos[index]}<input required minLength={2} name={`participant-${index}-fullName`} className="mt-1 w-full rounded border p-2" /></label>)}
    </fieldset>
    <fieldset className="space-y-3"><legend className="text-lg font-semibold">Políticas do evento</legend>
      {politicas.map((policy) => <label key={`${policy.type}-${policy.version}`} className="flex items-start gap-2 rounded border p-3"><input type="checkbox" checked={Boolean(accepted[policy.type])} onChange={(event) => setAccepted((current) => ({ ...current, [policy.type]: event.target.checked }))} aria-label={`Aceitar política ${policy.type}`} /><span><strong>{policy.type}</strong> <span className="text-sm text-slate-600">(Versão {policy.version})</span><span className="mt-1 block whitespace-pre-wrap text-sm">{policy.content}</span></span></label>)}
      {politicas.length !== TIPOS_POLITICA.length && <p className="text-sm text-amber-700">As políticas deste evento ainda não estão completas.</p>}
    </fieldset>
    {error && <p id="checkout-error" role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}{seatUnavailable && mapHref && <><br /><a href={mapHref} className="mt-2 inline-block font-semibold underline">Revisar assentos</a></>}</p>}
    <p className="text-sm text-slate-600">Assentos selecionados: {rotulosAssentos.join(", ") || "nenhum"}</p>
    <button type="submit" disabled={submitting || !hasAllPolicies || !hasSeats || !hasTicketTypes} className="rounded bg-blue-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400">{submitting ? "Processando…" : "Finalizar pedido"}</button>
  </form>;
}
