"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeusIngressosInput } from "@essencia/shared/schemas";
import type { MeusIngressosResult } from "@essencia/shared/types";
import { EventosApiError, buscarMeusIngressos } from "../../lib/eventos-api";
import { formatarDataHoraExtenso } from "../../lib/eventos-formatters";
import { classeBotaoAcao } from "../base/botao-acao";

type ModoBusca = "numero" | "dados";

type Props = {
  numeroInicial?: string;
};

const ERRO_NAO_ENCONTRADO = "Não encontramos um pedido com esses dados";
const ERRO_MUITAS_TENTATIVAS = "Muitas tentativas. Aguarde um instante e tente de novo.";

function hrefPedido(orderNumber: string, acesso: string): string {
  return `/pedido/${encodeURIComponent(orderNumber)}?acesso=${encodeURIComponent(acesso)}`;
}

function PedidosEncontrados({ pedidos }: { pedidos: MeusIngressosResult["pedidos"] }): React.JSX.Element {
  return (
    <section aria-live="polite" aria-labelledby="pedidos-encontrados" className="space-y-4 rounded-2xl border border-[var(--linha)] bg-[var(--cartao)] p-5">
      <h2 id="pedidos-encontrados" className="font-display text-xl font-semibold text-[var(--tinta)]">Pedidos encontrados</h2>
      <ul className="space-y-3">
        {pedidos.map((pedido) => (
          <li key={`${pedido.orderNumber}-${pedido.acesso}`} className="flex flex-col gap-3 rounded-xl border border-[var(--linha)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-[var(--tinta)]">{pedido.eventTitle}</h3>
              <time dateTime={new Date(pedido.sessionStartsAt).toISOString()} className="text-sm text-[var(--tinta-2)]">{formatarDataHoraExtenso(pedido.sessionStartsAt)}</time>
              <p className="mt-1 text-sm text-[var(--tinta-2)]">Pedido {pedido.orderNumber}</p>
            </div>
            <Link className={classeBotaoAcao("secundaria")} href={hrefPedido(pedido.orderNumber, pedido.acesso)}>Ver ingressos</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MeusIngressos({ numeroInicial = "" }: Props): React.JSX.Element {
  const router = useRouter();
  const [modo, setModo] = useState<ModoBusca>("numero");
  const [numero, setNumero] = useState(numeroInicial);
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [pedidos, setPedidos] = useState<MeusIngressosResult["pedidos"] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function alternarModo(novoModo: ModoBusca) {
    setModo(novoModo);
    setErro(null);
    setPedidos(null);
  }

  async function buscar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setPedidos(null);
    setCarregando(true);
    const input: MeusIngressosInput = modo === "numero"
      ? { orderNumber: numero.trim(), email: email.trim() }
      : { email: email.trim(), phone: celular.trim() };
    try {
      const resultado = await buscarMeusIngressos(input);
      if (resultado.pedidos.length === 0) {
        setErro(ERRO_NAO_ENCONTRADO);
      } else if (resultado.pedidos.length === 1) {
        const [pedido] = resultado.pedidos;
        if (pedido) router.push(hrefPedido(pedido.orderNumber, pedido.acesso));
      } else {
        setPedidos(resultado.pedidos);
      }
    } catch (cause) {
      if (cause instanceof EventosApiError && cause.status === 404) setErro(ERRO_NAO_ENCONTRADO);
      else if (cause instanceof EventosApiError && cause.status === 429) setErro(ERRO_MUITAS_TENTATIVAS);
      else setErro("Não foi possível consultar seus ingressos. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Como localizar o pedido" className="flex flex-wrap gap-2 border-b border-[var(--linha)]">
        <button type="button" role="tab" aria-selected={modo === "numero"} onClick={() => alternarModo("numero")} className={`min-h-11 border-b-2 px-3 py-2 text-left text-sm font-semibold ${modo === "numero" ? "border-[var(--acao)] text-[var(--acao)]" : "border-transparent text-[var(--tinta-2)]"}`}>
          Tenho o número do pedido
        </button>
        <button type="button" role="tab" aria-selected={modo === "dados"} onClick={() => alternarModo("dados")} className={`min-h-11 border-b-2 px-3 py-2 text-left text-sm font-semibold ${modo === "dados" ? "border-[var(--acao)] text-[var(--acao)]" : "border-transparent text-[var(--tinta-2)]"}`}>
          Não tenho o número
        </button>
      </div>

      <form onSubmit={buscar} className="max-w-xl space-y-4" aria-describedby={erro ? "meus-ingressos-erro" : undefined}>
        {modo === "numero" ? (
          <label className="block text-sm font-semibold text-[var(--tinta)]">Número do pedido
            <input name="orderNumber" value={numero} onChange={(event) => setNumero(event.target.value)} required autoComplete="off" className="mt-1 min-h-11 w-full rounded-lg border border-[var(--linha)] bg-[var(--cartao)] px-3 font-normal" />
          </label>
        ) : null}
        <label className="block text-sm font-semibold text-[var(--tinta)]">E-mail
          <input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="mt-1 min-h-11 w-full rounded-lg border border-[var(--linha)] bg-[var(--cartao)] px-3 font-normal" />
        </label>
        {modo === "dados" ? (
          <label className="block text-sm font-semibold text-[var(--tinta)]">Celular
            <input name="phone" type="tel" inputMode="tel" value={celular} onChange={(event) => setCelular(event.target.value)} required autoComplete="tel" className="mt-1 min-h-11 w-full rounded-lg border border-[var(--linha)] bg-[var(--cartao)] px-3 font-normal" />
          </label>
        ) : null}
        {erro ? <p id="meus-ingressos-erro" role="alert" className="rounded-lg border border-[#efb4b4] bg-[#fff1f1] p-3 text-sm text-[#8b1e1e]">{erro}</p> : null}
        <button type="submit" disabled={carregando} className={classeBotaoAcao()}>{carregando ? "Buscando…" : "Buscar ingressos"}</button>
      </form>

      {pedidos && pedidos.length > 0 ? <PedidosEncontrados pedidos={pedidos} /> : null}
    </div>
  );
}
