"use client";

import React from "react";
import type { PedidoPublicoResult, PublicEventDetail, PublicEventSession } from "@essencia/shared/types";
import { formatarDataPublica, formatarMoeda } from "../../lib/eventos-formatters";
import { CupomPedido } from "./cupom-pedido";

type Props = { pedido: PedidoPublicoResult; evento: PublicEventDetail; sessao: PublicEventSession; mapHref?: string; onAlterar: () => void; onAtualizar?: (pedido: PedidoPublicoResult) => void; alterando?: boolean };

function ConteudoResumo({ pedido, evento, sessao }: Pick<Props, "pedido" | "evento" | "sessao">): React.JSX.Element {
  return <>
    {evento.imageUrl && <img src={evento.imageUrl} alt="" className="mb-4 aspect-[16/8] w-full rounded-xl object-cover" />}
    <h2 className="font-display text-xl font-semibold text-[#1f2a24]">{evento.title}</h2>
    <p className="mt-2 text-sm text-[#647066]">{formatarDataPublica(sessao.startsAt, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</p>
    <p className="text-sm text-[#647066]">{evento.locationName ?? sessao.location?.name ?? "Local a confirmar"}</p>
    <ul className="mt-4 space-y-2 text-sm text-[#475248]">{pedido.items.map((item) => <li key={item.seatId}>{item.rowLabel}{item.seatNumber} · {item.ticketTypeName} · {formatarMoeda(item.totalPriceCents)}</li>)}</ul>
    {pedido.appliedOffer && <p className="mt-4 text-sm text-[#475248]">Oferta automática: <strong>{pedido.appliedOffer.name}</strong></p>}
    {pedido.appliedCoupon && <p className="mt-1 text-sm text-[#475248]">Cupom: <strong>{pedido.appliedCoupon.code}</strong></p>}
    <dl className="mt-4 space-y-1 border-t border-[#e6e9e1] pt-4 text-sm text-[#475248]"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatarMoeda(pedido.subtotalCents)}</dd></div>{(pedido.appliedOffer || pedido.offerDiscountCents > 0) && <div className="flex justify-between"><dt>Desconto da oferta</dt><dd>{pedido.offerDiscountCents > 0 ? `-${formatarMoeda(pedido.offerDiscountCents)}` : formatarMoeda(0)}</dd></div>}{(pedido.appliedCoupon || pedido.couponDiscountCents > 0) && <div className="flex justify-between"><dt>Desconto do cupom</dt><dd>{pedido.couponDiscountCents > 0 ? `-${formatarMoeda(pedido.couponDiscountCents)}` : formatarMoeda(0)}</dd></div>}<div className="flex justify-between"><dt>Desconto total</dt><dd>{pedido.discountCents > 0 ? `-${formatarMoeda(pedido.discountCents)}` : formatarMoeda(0)}</dd></div><div className="mt-2 flex justify-between text-base font-semibold text-[#1f2a24]"><dt>Total</dt><dd>{formatarMoeda(pedido.totalCents)}</dd></div></dl>
    {pedido.totalCents === 0 && <p role="status" className="mt-3 rounded-lg bg-[#f1f7e9] p-3 text-sm text-[#3f6f12]"><strong>Pedido gratuito</strong> — você não precisará informar pagamento.</p>}
  </>;
}

export function ResumoPedido({ pedido, evento, sessao, mapHref = "#", onAlterar, onAtualizar = () => undefined, alterando = false }: Props): React.JSX.Element {
  const lugares = pedido.items.map((item) => `${item.rowLabel}${item.seatNumber}`).join(", ");
  return <aside className="lg:sticky lg:top-6 lg:self-start"><details className="rounded-2xl border border-[#e6e9e1] bg-white shadow-sm lg:hidden"><summary className="cursor-pointer list-none p-4 font-semibold text-[#1f2a24]">{pedido.items.length} {pedido.items.length === 1 ? "lugar" : "lugares"} · {lugares} ▾ · {formatarMoeda(pedido.totalCents)}</summary><div className="border-t border-[#e6e9e1] p-5"><ConteudoResumo pedido={pedido} evento={evento} sessao={sessao} /></div></details><section aria-label="Resumo do pedido" className="hidden rounded-2xl border border-[#e6e9e1] bg-white p-5 shadow-sm lg:block"><ConteudoResumo pedido={pedido} evento={evento} sessao={sessao} /></section><CupomPedido pedido={pedido} onAtualizar={onAtualizar} /><a href={mapHref} aria-disabled={alterando} onClick={(event) => { event.preventDefault(); if (!alterando) onAlterar(); }} className="mt-3 inline-flex min-h-10 items-center font-semibold text-[#3f6f12] underline aria-disabled:opacity-60">{alterando ? "Liberando lugares…" : "Alterar lugares"}</a></aside>;
}
