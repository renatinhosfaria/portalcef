"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PedidoComIngressos } from "@essencia/shared/types";
import { EventosApiError, obterIngressos } from "../../lib/eventos-api";
import { gerarPdfIngressos, nomeArquivoIngresso } from "../../lib/pdf-ingresso";
import { MeusIngressos } from "./meus-ingressos";
import { CartaoIngresso } from "./cartao-ingresso";
import { classeBotaoAcao } from "../base/botao-acao";

const PENDENTES = new Set(["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO", "PENDENTE", "PROCESSANDO"]);

export function PaginaIngressos({ inicial, orderNumber, acesso }: { inicial: PedidoComIngressos | null; orderNumber: string; acesso: string }): React.JSX.Element {
  const [pedido, setPedido] = useState(inicial);
  const [baixando, setBaixando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState(false);
  const cicloPollingRef = useRef(0);
  const requisicaoRef = useRef(0);
  const statusAtual = pedido?.status;

  useEffect(() => {
    if (!PENDENTES.has(statusAtual ?? "") || !acesso) return;
    const ciclo = ++cicloPollingRef.current;
    let tentativas = 0;
    let timer: number | undefined;
    const consultarNovamente = () => {
      if (ciclo !== cicloPollingRef.current || tentativas >= 30) return;
      tentativas += 1;
      const requisicao = ++requisicaoRef.current;
      void obterIngressos(orderNumber, acesso).then((resultado) => {
        if (ciclo !== cicloPollingRef.current || requisicao !== requisicaoRef.current) return;
        setPedido(resultado);
      }).catch((erro: unknown) => {
        if (ciclo !== cicloPollingRef.current || requisicao !== requisicaoRef.current) return;
        if (erro instanceof EventosApiError && erro.status === 404) setErroAcesso(true);
      }).finally(() => {
        if (ciclo === cicloPollingRef.current && requisicao === requisicaoRef.current) timer = window.setTimeout(consultarNovamente, 2000);
      });
    };
    timer = window.setTimeout(consultarNovamente, 2000);
    return () => {
      if (timer) window.clearTimeout(timer);
      cicloPollingRef.current += 1;
      requisicaoRef.current += 1;
    };
  }, [acesso, orderNumber, statusAtual]);

  if (!acesso || !pedido || erroAcesso) return <section className="content-narrow space-y-5 py-12"><h1 className="font-display text-2xl font-bold">{erroAcesso ? "Não conseguimos abrir seus ingressos por este link." : "Meus ingressos"}</h1><MeusIngressos numeroInicial={orderNumber} /></section>;
  if (pedido.status === "CANCELADO" || pedido.status === "EXPIRADO") return <section className="content-narrow space-y-5 py-12"><h1 className="font-display text-2xl font-bold">Pedido indisponível</h1><p role="alert">Este pedido foi {pedido.status === "CANCELADO" ? "cancelado" : "expirado"}.</p><Link className={classeBotaoAcao("secundaria")} href={`/evento/${pedido.eventSlug}`}>Voltar ao evento</Link></section>;
  if (PENDENTES.has(pedido.status)) return <section className="content-narrow space-y-5 py-12" aria-live="polite"><h1 className="font-display text-2xl font-bold">Confirmando seu pagamento…</h1><p>Assim que o pagamento for confirmado, seus ingressos aparecerão aqui.</p></section>;
  const pedidoConfirmado = pedido;

  async function baixarTodos() {
    setBaixando(true);
    try {
      const blob = await gerarPdfIngressos(pedidoConfirmado, pedidoConfirmado.tickets);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = nomeArquivoIngresso(pedidoConfirmado); link.click(); URL.revokeObjectURL(url);
    } finally { setBaixando(false); }
  }

  return <section className="content-narrow space-y-8 py-10"><header className="space-y-2"><p className="text-sm font-semibold uppercase tracking-wide text-[var(--acao)]">Pagamento confirmado</p><h1 className="font-display text-3xl font-bold">Pedido nº {pedidoConfirmado.orderNumber} · {pedidoConfirmado.buyerName ?? "Comprador"}</h1><button type="button" className={`${classeBotaoAcao("secundaria")} print:hidden`} onClick={baixarTodos} disabled={baixando}>{baixando ? "Preparando…" : "Baixar todos"}</button></header><div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">{pedidoConfirmado.tickets.map((ingresso, indice) => <div key={ingresso.numero} className="ingresso-item min-w-[min(88vw,28rem)] md:min-w-0"><CartaoIngresso pedido={pedidoConfirmado} ingresso={ingresso} indice={indice} total={pedidoConfirmado.tickets.length} /><p className="mt-2 text-center text-sm text-[var(--tinta-2)] print:hidden md:hidden">Ingresso {indice + 1} de {pedidoConfirmado.tickets.length}</p></div>)}</div></section>;
}
