"use client";

import React from "react";
import Image from "next/image";
import type { IngressoPublico, PedidoComIngressos } from "@essencia/shared/types";
import { AVISOS_INGRESSO, coresClassificacaoEtaria, descreverClassificacaoEtaria, formatarNumeroIngresso, formatarValorIngresso, siglaClassificacaoEtaria } from "@essencia/shared/eventos/ingresso";
import { formatarDataHoraExtenso } from "../../lib/eventos-formatters";
import { QrIngresso } from "./qr-ingresso";
import { AcoesIngresso } from "./acoes-ingresso";

function ClassificacaoIndicativa({ classificacao }: { classificacao: NonNullable<PedidoComIngressos["event"]["classificacaoEtaria"]> }): React.JSX.Element {
  const cores = coresClassificacaoEtaria(classificacao);
  return (
    <p className="mt-1 flex items-center gap-2 text-sm text-white/85">
      <span aria-hidden="true" className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-white px-0.5 text-[11px] font-bold leading-none" style={{ backgroundColor: cores.fundo, color: cores.texto }}>{siglaClassificacaoEtaria(classificacao)}</span>
      <span>{descreverClassificacaoEtaria(classificacao)}</span>
    </p>
  );
}

export function CartaoIngresso({ pedido, ingresso, indice, total }: { pedido: PedidoComIngressos; ingresso: IngressoPublico; indice: number; total: number }): React.JSX.Element {
  return (
    <article className="ingresso-cartao snap-center overflow-hidden rounded-3xl border border-[var(--linha)] bg-[var(--cartao)] shadow-sm">
      <header className="relative flex min-h-28 items-end gap-4 bg-[var(--tinta)] p-5 text-white">
        {pedido.event.imageUrl ? <Image src={pedido.event.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover opacity-35" /> : null}
        <div className="relative z-10"><h2 className="font-display text-xl font-semibold">{pedido.event.title}</h2><p className="text-sm text-white/85">{formatarDataHoraExtenso(pedido.session.startsAt, pedido.session.endsAt)}</p><p className="text-sm text-white/85">{pedido.event.locationName ?? "Local a confirmar"}</p>{pedido.event.classificacaoEtaria ? <ClassificacaoIndicativa classificacao={pedido.event.classificacaoEtaria} /> : null}</div>
      </header>
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-xl bg-[var(--surface-muted)] p-3"><dt className="text-xs uppercase tracking-wide text-[var(--tinta-2)]">Fileira</dt><dd className="mt-1 text-2xl font-bold">{ingresso.rowLabel}</dd></div><div className="rounded-xl bg-[var(--surface-muted)] p-3"><dt className="text-xs uppercase tracking-wide text-[var(--tinta-2)]">Assento</dt><dd className="mt-1 text-2xl font-bold">{ingresso.seatNumber}</dd></div><div className="rounded-xl bg-[var(--surface-muted)] p-3"><dt className="text-xs uppercase tracking-wide text-[var(--tinta-2)]">Ingresso</dt><dd className="mt-1 text-sm font-bold">{ingresso.ticketTypeName}</dd></div></div>
        <div className="flex flex-col items-center gap-3"><QrIngresso conteudo={ingresso.qrPayload} /><p className="text-center text-sm text-[var(--tinta-2)]">Na entrada, mostre o QR code ou informe o número.</p></div>
        <dl className="space-y-2 border-t border-[var(--linha)] pt-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-[var(--tinta-2)]">Número do ingresso</dt><dd className="font-mono font-semibold">{formatarNumeroIngresso(ingresso.numero)}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--tinta-2)]">Participante</dt><dd className="font-semibold">{ingresso.participantName}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--tinta-2)]">Valor do ingresso</dt><dd className="font-semibold">{formatarValorIngresso(ingresso.priceCents)}</dd></div></dl>
        <ul className="space-y-1 rounded-xl bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--tinta)]">{AVISOS_INGRESSO.map((aviso) => <li key={aviso} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--acao)]" /><span>{aviso}</span></li>)}</ul>
        <AcoesIngresso pedido={pedido} ingresso={ingresso} indice={indice} total={total} />
      </div>
    </article>
  );
}
