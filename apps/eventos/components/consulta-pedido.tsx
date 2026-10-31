"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { ConsultaPedidoPublica } from "@essencia/shared/types";
import { consultarPedido, EventosApiError } from "../lib/eventos-api";
import { formatarDataPublica } from "../lib/eventos-formatters";

export const MAX_TENTATIVAS_POLLING = 5;
export const INTERVALO_POLLING_MS = 1500;

export function ehStatusPendentePedido(status: string): boolean {
  return ["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"].includes(status);
}

const ROTULOS_STATUS: Record<string, string> = {
  INICIADO: "Pagamento pendente",
  RESERVADO: "Pagamento pendente",
  AGUARDANDO_PAGAMENTO: "Pagamento pendente",
  PAGO: "Pago",
  CONCLUIDO: "Concluído",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
  ESTORNADO: "Estornado",
  CONFIRMADO: "Confirmado",
};

export function rotuloStatusPedido(status: string): string {
  return ROTULOS_STATUS[status] ?? "Status do pedido: indisponível";
}

export type PedidoPublicoStatusProps = { result: ConsultaPedidoPublica; retorno?: "sucesso" | "cancelado" };

export function PedidoRetorno({ retorno }: { retorno?: "sucesso" | "cancelado" }) {
  if (retorno === "sucesso") return <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">Pagamento recebido. Estamos aguardando a confirmação automática.</p>;
  if (retorno === "cancelado") return <p className="rounded border border-slate-300 bg-slate-50 p-3">O pagamento não foi concluído. Você pode consultar o pedido novamente.</p>;
  return null;
}

export function PedidoPublicoStatus({ result, retorno }: PedidoPublicoStatusProps) {
  const pagamentoPendente = ehStatusPendentePedido(result.status);
  return <section aria-live="polite" className="space-y-3 rounded-xl border bg-white p-5">
    <PedidoRetorno retorno={retorno} />
    <h2 className="text-xl font-semibold">Pedido {result.orderNumber}</h2>
    <p><strong>Evento:</strong> {result.eventTitle}</p>
    <p><strong>Sessão:</strong> {formatarDataPublica(result.session.startsAt, { hour: "2-digit", minute: "2-digit" })}</p>
    <p><strong>Status:</strong> {rotuloStatusPedido(result.status)}</p>
    {pagamentoPendente && <p className="rounded bg-amber-50 p-3 text-amber-900">Pagamento pendente: aguardando confirmação do pagamento.</p>}
    <p><strong>Itens:</strong> {result.items.length}</p>
  </section>;
}

type Props = {
  initialOrderNumber?: string;
  initialResult?: ConsultaPedidoPublica | null;
  autoAtualizar?: boolean;
  retorno?: "sucesso" | "cancelado";
  onResult?: (result: ConsultaPedidoPublica) => void;
};

export function ConsultaPedido({ initialOrderNumber = "", initialResult = null, autoAtualizar = false, retorno, onResult }: Props): React.JSX.Element {
  const [number, setNumber] = useState(initialOrderNumber);
  const [result, setResult] = useState<ConsultaPedidoPublica | null>(initialResult);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [limitePolling, setLimitePolling] = useState(false);
  const [numeroEditado, setNumeroEditado] = useState(false);

  useEffect(() => { if (initialResult) onResult?.(initialResult); }, [initialResult, onResult]);

  const atualizarPedido = useCallback(async (orderNumber: string) => {
    const next = await consultarPedido(orderNumber);
    setResult(next);
    onResult?.(next);
    return next;
  }, [onResult]);

  useEffect(() => {
    const pollingOrderNumber = initialOrderNumber.trim();
    if (!autoAtualizar || numeroEditado || !initialResult || !ehStatusPendentePedido(initialResult.status) || !pollingOrderNumber) return undefined;
    let cancelado = false;
    let tentativas = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const polling = async () => {
      if (cancelado || tentativas >= MAX_TENTATIVAS_POLLING) return;
      tentativas += 1;
      try {
        const next = await consultarPedido(pollingOrderNumber);
        if (cancelado) return;
        setResult(next);
        onResult?.(next);
        if (ehStatusPendentePedido(next.status) && tentativas < MAX_TENTATIVAS_POLLING) timer = setTimeout(polling, INTERVALO_POLLING_MS);
        else if (ehStatusPendentePedido(next.status)) setLimitePolling(true);
      } catch (cause) {
        if (cancelado) return;
        setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o pedido.");
        if (tentativas < MAX_TENTATIVAS_POLLING) timer = setTimeout(polling, INTERVALO_POLLING_MS);
        else setLimitePolling(true);
      }
    };

    timer = setTimeout(polling, INTERVALO_POLLING_MS);
    return () => { cancelado = true; if (timer) clearTimeout(timer); };
  }, [autoAtualizar, initialOrderNumber, initialResult, atualizarPedido, numeroEditado, onResult]);

  async function consultar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLimitePolling(false);
    if (!number.trim()) { setError("Informe o número do pedido."); return; }
    setLoading(true);
    try { await atualizarPedido(number); }
    catch (cause) {
      setResult(null);
      if (cause instanceof EventosApiError && cause.status === 429) setError("Muitas consultas em pouco tempo. Aguarde um instante e tente novamente.");
      else setError(cause instanceof Error ? cause.message : "Pedido não encontrado.");
    }
    finally { setLoading(false); }
  }

  async function atualizarManualmente() {
    setError(null);
    setLimitePolling(false);
    setLoading(true);
    try { await atualizarPedido(number); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o pedido."); }
    finally { setLoading(false); }
  }

  return <div className="space-y-5">
    <form onSubmit={consultar} className="max-w-md space-y-3" aria-describedby={error ? "consulta-error" : undefined}>
      <label className="block">Número do pedido<input required name="orderNumber" value={number} onChange={(event) => { setNumber(event.target.value); if (autoAtualizar) setNumeroEditado(true); }} className="mt-1 w-full rounded border p-2" placeholder="Ex.: ABC123DEF456" autoComplete="off" /></label>
      {error && <p id="consulta-error" role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      <button disabled={loading} className="rounded bg-blue-700 px-4 py-2 text-white disabled:bg-slate-400">{loading ? "Consultando…" : "Consultar pedido"}</button>
    </form>
    {!result && <PedidoRetorno retorno={retorno} />}
    {result && <PedidoPublicoStatus result={result} retorno={retorno} />}
    {limitePolling && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900"><p>O pagamento ainda está sendo processado.</p><button type="button" onClick={atualizarManualmente} disabled={loading} className="mt-2 rounded border border-amber-700 px-3 py-1 text-sm">Atualizar agora</button></div>}
  </div>;
}
