"use client";

import React, { useEffect, useState } from "react";
import type { ConsultaPedidoPublica } from "@essencia/shared/types";
import { consultarPedido, EventosApiError } from "../lib/eventos-api";

type Props = { initialOrderNumber?: string; initialResult?: ConsultaPedidoPublica | null; onResult?: (result: ConsultaPedidoPublica) => void };

function ResultadoPedido({ result }: { result: ConsultaPedidoPublica }) {
  const pagamentoPendente = ["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"].includes(result.status);
  return <section aria-live="polite" className="space-y-3 rounded-xl border bg-white p-5">
    <h2 className="text-xl font-semibold">Pedido {result.orderNumber}</h2>
    <p><strong>Evento:</strong> {result.eventTitle}</p>
    <p><strong>Sessão:</strong> {new Date(result.session.startsAt).toLocaleString("pt-BR")}</p>
    <p><strong>Status:</strong> {pagamentoPendente ? "Pagamento pendente" : result.status}</p>
    {pagamentoPendente && <p className="rounded bg-amber-50 p-3 text-amber-900">Pagamento pendente: aguardando confirmação do pagamento.</p>}
    <p><strong>Itens:</strong> {result.items.length}</p>
  </section>;
}

export function ConsultaPedido({ initialOrderNumber = "", initialResult = null, onResult }: Props) {
  const [number, setNumber] = useState(initialOrderNumber);
  const [result, setResult] = useState<ConsultaPedidoPublica | null>(initialResult);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (initialResult) onResult?.(initialResult); }, [initialResult, onResult]);

  async function consultar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!number.trim()) return setError("Informe o número do pedido.");
    setLoading(true);
    try {
      const next = await consultarPedido(number);
      setResult(next);
      onResult?.(next);
    } catch (cause) {
      setResult(null);
      if (cause instanceof EventosApiError && cause.status === 429) setError("Muitas consultas em pouco tempo. Aguarde um instante e tente novamente.");
      else setError(cause instanceof Error ? cause.message : "Pedido não encontrado.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="space-y-5">
    <form onSubmit={consultar} className="max-w-md space-y-3" aria-describedby={error ? "consulta-error" : undefined}>
      <label className="block">Número do pedido<input required name="orderNumber" value={number} onChange={(event) => setNumber(event.target.value)} className="mt-1 w-full rounded border p-2" placeholder="Ex.: ABC123DEF456" autoComplete="off" /></label>
      {error && <p id="consulta-error" role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      <button disabled={loading} className="rounded bg-blue-700 px-4 py-2 text-white disabled:bg-slate-400">{loading ? "Consultando…" : "Consultar pedido"}</button>
    </form>
    {result && <ResultadoPedido result={result} />}
  </div>;
}
