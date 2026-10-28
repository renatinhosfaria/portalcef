"use client";

import React, { useMemo, useRef, useState } from "react";
import type { PoliticaPublica, PedidoPublicoResult } from "@essencia/shared/types";
import { EventosApiError, finalizarPedido, gerarChaveIdempotenciaPublica, iniciarCheckout, origemPublicaEventos, reservarAssentos } from "../lib/eventos-api";

const TIPOS_POLITICA: PoliticaPublica["type"][] = ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"];

export function aceitesCompletos(acceptances: Array<{ type: PoliticaPublica["type"]; version: number }>) {
  return acceptances.length === TIPOS_POLITICA.length && new Set(acceptances.map((acceptance) => acceptance.type)).size === TIPOS_POLITICA.length && TIPOS_POLITICA.every((type) => acceptances.some((acceptance) => acceptance.type === type && Number.isInteger(acceptance.version) && acceptance.version > 0));
}

type Props = {
  seatIds: string[];
  ticketTypeIds?: string[];
  sessionId?: string;
  politicas?: PoliticaPublica[];
  onComplete?: (pedido: PedidoPublicoResult) => void;
};

export function FormularioCheckout({ seatIds, ticketTypeIds = [], sessionId, politicas = [], onComplete }: Props) {
  const reservationKeyRef = useRef<string | null>(null);
  if (!reservationKeyRef.current) reservationKeyRef.current = gerarChaveIdempotenciaPublica("reserva");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hasAllPolicies = useMemo(() => politicas.length === TIPOS_POLITICA.length && TIPOS_POLITICA.every((type) => accepted[type]), [accepted, politicas.length]);
  const hasSeats = seatIds.length > 0 && seatIds.every((seatId) => seatId.trim());
  const hasTicketTypes = seatIds.length > 0 && seatIds.every((_, index) => Boolean(ticketTypeIds[index] || ticketTypeIds[0]));

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
    try {
      const reservationKey = reservationKeyRef.current ?? gerarChaveIdempotenciaPublica("reserva");
      reservationKeyRef.current = reservationKey;
      const reservation = await reservarAssentos({ sessionId, idempotencyKey: reservationKey, seats: seatIds.map((seatId, index) => ({ seatId, ticketTypeId: ticketTypeIds[index] || ticketTypeIds[0] || "", participantIndex: index })), buyer });
      const pedido = await finalizarPedido(reservation.orderNumber, { participants, acceptances: politicas.map((policy) => ({ type: policy.type, version: policy.version })) });
      setPending(true);
      onComplete?.(pedido);
      const checkout = await iniciarCheckout(reservation.orderNumber, { successUrl: `${origemPublicaEventos()}/pedido/${encodeURIComponent(reservation.orderNumber)}?retorno=sucesso`, cancelUrl: `${origemPublicaEventos()}/pedido/${encodeURIComponent(reservation.orderNumber)}?retorno=cancelado` });
      if (typeof window !== "undefined") window.location.assign(checkout.checkoutUrl);
    } catch (cause) {
      setPending(false);
      if (cause instanceof EventosApiError && cause.status === 409) setError(cause.message);
      else if (cause instanceof EventosApiError && cause.status === 429) setError("Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.");
      else setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o pagamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pending) return <p role="status" className="rounded border border-amber-300 bg-amber-50 p-4">Pagamento pendente: aguardando confirmação do pagamento.</p>;

  return <form onSubmit={enviar} noValidate className="max-w-xl space-y-6 rounded-xl border bg-white p-6" aria-describedby={error ? "checkout-error" : undefined}>
    <fieldset className="space-y-3"><legend className="text-lg font-semibold">Dados do comprador</legend>
      <label className="block">Nome completo<input required minLength={2} name="buyerName" autoComplete="name" className="mt-1 w-full rounded border p-2" /></label>
      <label className="block">E-mail<input required type="email" name="buyerEmail" autoComplete="email" className="mt-1 w-full rounded border p-2" /></label>
      <label className="block">Telefone<input required minLength={8} name="buyerPhone" autoComplete="tel" className="mt-1 w-full rounded border p-2" /></label>
    </fieldset>
    <fieldset className="space-y-3"><legend className="text-lg font-semibold">Participantes</legend>
      {seatIds.map((seatId, index) => <label key={seatId} className="block">Nome do participante do assento {seatId}<input required minLength={2} name={`participant-${index}-fullName`} className="mt-1 w-full rounded border p-2" /></label>)}
    </fieldset>
    <fieldset className="space-y-3"><legend className="text-lg font-semibold">Políticas do evento</legend>
      {politicas.map((policy) => <label key={`${policy.type}-${policy.version}`} className="flex items-start gap-2 rounded border p-3"><input type="checkbox" checked={Boolean(accepted[policy.type])} onChange={(event) => setAccepted((current) => ({ ...current, [policy.type]: event.target.checked }))} aria-label={`Aceitar política ${policy.type}`} /><span><strong>{policy.type}</strong> <span className="text-sm text-slate-600">(Versão {policy.version})</span><span className="mt-1 block whitespace-pre-wrap text-sm">{policy.content}</span></span></label>)}
      {politicas.length !== TIPOS_POLITICA.length && <p className="text-sm text-amber-700">As políticas deste evento ainda não estão completas.</p>}
    </fieldset>
    {error && <p id="checkout-error" role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
    <p className="text-sm text-slate-600">Assentos selecionados: {seatIds.join(", ") || "nenhum"}</p>
    <button type="submit" disabled={submitting || !hasAllPolicies || !hasSeats || !hasTicketTypes} className="rounded bg-blue-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400">{submitting ? "Processando…" : "Finalizar pedido"}</button>
  </form>;
}
