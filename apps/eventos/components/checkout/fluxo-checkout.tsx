"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PedidoPublicoResult, PoliticaPublica, PublicEventDetail, PublicEventSession } from "@essencia/shared/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventosApiError, finalizarPedido, gerarChaveIdempotenciaPublica, iniciarPagamento, liberarPedido } from "../../lib/eventos-api";
import { montarHrefRetornoMapa, montarUrlRetornoPagamento } from "../../lib/checkout-utils";
import { EtapasCompra } from "../base/etapas-compra";
import { PagamentoEmbutido } from "./pagamento-embutido";
import { FormularioDados, type DadosCheckout } from "./formulario-dados";
import { RelogioReserva } from "./relogio-reserva";
import { ResumoPedido } from "./resumo-pedido";
import { TempoEsgotado } from "./tempo-esgotado";

const ESTADOS_ATIVOS = new Set(["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"]);

type Props = { pedido: PedidoPublicoResult; evento: PublicEventDetail; sessao: PublicEventSession; politicas: PoliticaPublica[]; publishableKey: string | null };

export function FluxoCheckout({ pedido, evento, sessao, politicas, publishableKey }: Props): React.JSX.Element {
  const router = useRouter();
  const seatIds = useMemo(() => pedido.items.map((item) => item.seatId), [pedido.items]);
  const ticketTypeIds = useMemo(() => pedido.items.map((item) => item.ticketTypeId), [pedido.items]);
  const retornoMapa = useMemo(() => montarHrefRetornoMapa({ slug: evento.slug, sessionId: pedido.sessionId, seatIds, ticketTypeIds }), [evento.slug, pedido.sessionId, seatIds, ticketTypeIds]);
  const retornoMapaDisponibilidade = useMemo(() => montarHrefRetornoMapa({ slug: evento.slug, sessionId: pedido.sessionId, seatIds, ticketTypeIds, motivo: "disponibilidade" }), [evento.slug, pedido.sessionId, seatIds, ticketTypeIds]);
  const [etapa, setEtapa] = useState<2 | 3>(2);
  const [expiraEm, setExpiraEm] = useState<Date | string | null>(pedido.expiresAt);
  const [expirado, setExpirado] = useState(() => !pedido.expiresAt || new Date(pedido.expiresAt).getTime() <= Date.now());
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [alterando, setAlterando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const expiradoRef = useRef(expirado);
  const finalizacaoKeyRef = useRef<string | null>(null);
  const pagamentoKeyRef = useRef<string | null>(null);
  const liberacaoPromiseRef = useRef<Promise<void> | null>(null);
  const expiracaoInicialTratadaRef = useRef<string | null>(null);

  const acessoGuardado = useCallback(() => typeof window === "undefined" ? null : window.sessionStorage.getItem(`eventos:acesso:${pedido.orderNumber}`), [pedido.orderNumber]);
  const irParaIngressos = useCallback(() => {
    const acesso = acessoGuardado();
    router.push(acesso ? `/pedido/${encodeURIComponent(pedido.orderNumber)}?acesso=${encodeURIComponent(acesso)}` : `/pedido/consulta?pedido=${encodeURIComponent(pedido.orderNumber)}`);
  }, [acessoGuardado, pedido.orderNumber, router]);
  const liberarUmaVez = useCallback(() => {
    if (!liberacaoPromiseRef.current) liberacaoPromiseRef.current = liberarPedido(pedido.orderNumber);
    return liberacaoPromiseRef.current;
  }, [pedido.orderNumber]);

  const tratarExpiracao = useCallback(async () => {
    try {
      await liberarUmaVez();
    } catch (cause) {
      if (cause instanceof EventosApiError && cause.code === "PAYMENT_ALREADY_COMPLETED") irParaIngressos();
      else if (cause instanceof EventosApiError && ["ORDER_NOT_AVAILABLE", "RESERVATION_EXPIRED", "RESERVATION_CANCELLED"].includes(cause.code ?? "")) router.push(retornoMapaDisponibilidade);
      else setErro(cause instanceof Error ? cause.message : "Não foi possível liberar os lugares.");
    }
  }, [irParaIngressos, liberarUmaVez, retornoMapaDisponibilidade, router]);

  const marcarEsgotado = useCallback(() => {
    expiradoRef.current = true;
    setExpirado(true);
    void tratarExpiracao();
  }, [tratarExpiracao]);
  const alterarLugares = useCallback(async () => {
    setErro(null);
    setAlterando(true);
    try {
      await liberarUmaVez();
      router.push(retornoMapa);
    } catch (cause) {
      if (cause instanceof EventosApiError && cause.code === "PAYMENT_ALREADY_COMPLETED") irParaIngressos();
      else if (cause instanceof EventosApiError && ["ORDER_NOT_AVAILABLE", "RESERVATION_EXPIRED", "RESERVATION_CANCELLED"].includes(cause.code ?? "")) router.push(retornoMapaDisponibilidade);
      else setErro(cause instanceof Error ? cause.message : "Não foi possível alterar os lugares.");
    } finally { setAlterando(false); }
  }, [irParaIngressos, liberarUmaVez, retornoMapa, retornoMapaDisponibilidade, router]);

  async function enviar(dados: DadosCheckout) {
    setErro(null);
    if (expiradoRef.current) return;
    try {
      if (!finalizacaoKeyRef.current) finalizacaoKeyRef.current = gerarChaveIdempotenciaPublica("finalizacao");
      const finalizacao = await finalizarPedido(pedido.orderNumber, { buyer: dados.buyer, participants: dados.participants, acceptances: politicas.map(({ type, version }) => ({ type, version })), idempotencyKey: finalizacaoKeyRef.current });
      if (typeof window !== "undefined") window.sessionStorage.setItem(`eventos:acesso:${pedido.orderNumber}`, finalizacao.acesso);
      if (finalizacao.pedido.expiresAt) setExpiraEm(finalizacao.pedido.expiresAt);
      expiradoRef.current = false;
      setExpirado(false);
      if (!pagamentoKeyRef.current) pagamentoKeyRef.current = gerarChaveIdempotenciaPublica("pagamento");
      const pagamento = await iniciarPagamento(pedido.orderNumber, { returnUrl: montarUrlRetornoPagamento(pedido.orderNumber, finalizacao.acesso), idempotencyKey: pagamentoKeyRef.current });
      setExpiraEm(pagamento.expiresAt);
      expiradoRef.current = false;
      setExpirado(false);
      setClientSecret(pagamento.clientSecret);
      setEtapa(3);
    } catch (cause) {
      if (cause instanceof EventosApiError && cause.code === "ORDER_NOT_AVAILABLE") {
        marcarEsgotado();
      }
      else setErro(cause instanceof Error ? cause.message : "Não foi possível iniciar o pagamento.");
    }
  }

  useEffect(() => {
    if (pedido.status !== "AGUARDANDO_PAGAMENTO") return undefined;
    const acesso = acessoGuardado();
    if (!acesso) return undefined;
    let ativo = true;
    if (!pagamentoKeyRef.current) pagamentoKeyRef.current = gerarChaveIdempotenciaPublica("pagamento");
    void iniciarPagamento(pedido.orderNumber, { returnUrl: montarUrlRetornoPagamento(pedido.orderNumber, acesso), idempotencyKey: pagamentoKeyRef.current })
      .then((pagamento) => {
        if (!ativo) return;
        setExpiraEm(pagamento.expiresAt);
        expiradoRef.current = false;
        setExpirado(false);
        setClientSecret(pagamento.clientSecret);
        setEtapa(3);
      })
      .catch((cause: unknown) => {
        if (!ativo) return;
        if (cause instanceof EventosApiError && cause.code === "ORDER_NOT_AVAILABLE") marcarEsgotado();
        else setErro(cause instanceof Error ? cause.message : "Não foi possível retomar o pagamento.");
      });
    return () => { ativo = false; };
  }, [acessoGuardado, marcarEsgotado, pedido.orderNumber, pedido.status]);

  useEffect(() => {
    if (!ESTADOS_ATIVOS.has(pedido.status) || !expirado || expiracaoInicialTratadaRef.current === pedido.orderNumber) return;
    if (pedido.status === "AGUARDANDO_PAGAMENTO" && acessoGuardado()) return;
    expiracaoInicialTratadaRef.current = pedido.orderNumber;
    void tratarExpiracao();
  }, [acessoGuardado, expirado, pedido.orderNumber, pedido.status, tratarExpiracao]);

  if (!ESTADOS_ATIVOS.has(pedido.status)) return <section role="alert" className="rounded-2xl border border-[#e6e9e1] bg-white p-6"><p>Este pedido não está mais disponível para pagamento.</p><Link className="mt-4 inline-flex font-semibold text-[#3f6f12] underline" href="/pedido/consulta">Meus ingressos</Link></section>;
  if (expirado || !expiraEm) return <TempoEsgotado href={retornoMapaDisponibilidade} />;

  return <div className="space-y-5"><RelogioReserva expiraEm={expiraEm} onEsgotar={marcarEsgotado} /><div className="content-width py-5 pt-16"><EtapasCompra atual={etapa} /><div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]"><main className="min-w-0 space-y-5">{etapa === 2 ? <FormularioDados items={pedido.items} politicas={politicas} onEnviar={enviar} bloqueado={expirado} /> : <section className="rounded-2xl border border-[#e6e9e1] bg-white p-5"><PagamentoEmbutido publishableKey={publishableKey} clientSecret={clientSecret ?? ""} /></section>}{erro && <p role="alert" className="rounded-lg border border-[#efb4b4] bg-[#fff1f1] p-3 text-sm text-[#8b1e1e]">{erro}</p>}</main><ResumoPedido pedido={pedido} evento={evento} sessao={sessao} mapHref={retornoMapa} onAlterar={alterarLugares} alterando={alterando} /></div></div></div>;
}
