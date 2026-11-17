"use client";

import React, { useId, useState } from "react";
import type { EvidenciaPacote, PedidoPublicoResult, PublicEventDetail, PublicEventSession } from "@essencia/shared/types";
import { formatarDataPublica, formatarMoeda } from "../../lib/eventos-formatters";
import { CupomPedido } from "./cupom-pedido";

type Props = { pedido: PedidoPublicoResult; evento: PublicEventDetail; sessao: PublicEventSession; mapHref?: string; onAlterar: () => void; onAtualizar?: (pedido: PedidoPublicoResult) => void; alterando?: boolean; permitirCupom?: boolean };

function DetalhesResumo({ pedido, evento, sessao }: Pick<Props, "pedido" | "evento" | "sessao">): React.JSX.Element {
  const pacotes = new Map<string, { evidencia: EvidenciaPacote; grupos: Set<string>; itens: PedidoPublicoResult["items"] }>();
  for (const item of pedido.items) {
    if (!item.pacote) continue;
    const evidencia = item.pacote;
    const chave = JSON.stringify([item.ticketTypeId, evidencia.versaoTipo, evidencia.lugaresPorPacote, evidencia.precoPacoteCentavos, evidencia.nomeTipo]);
    const grupo = pacotes.get(chave) ?? { evidencia, grupos: new Set<string>(), itens: [] };
    grupo.grupos.add(evidencia.id);
    grupo.itens.push(item);
    pacotes.set(chave, grupo);
  }
  return <>
    {evento.imageUrl && <img src={evento.imageUrl} alt="" className="mb-4 aspect-[16/8] w-full rounded-xl object-cover" />}
    <h2 className="font-display text-xl font-semibold text-[#1f2a24]">{evento.title}</h2>
    <p className="mt-2 text-sm text-[#647066]">{formatarDataPublica(sessao.startsAt, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</p>
    <p className="text-sm text-[#647066]">{evento.locationName ?? sessao.location?.name ?? "Local a confirmar"}</p>
    <ul className="mt-4 space-y-2 text-sm text-[#475248]">{pedido.items.filter(item => !item.pacote).map((item) => <li key={item.seatId}>{item.rowLabel}{item.seatNumber} · {item.ticketTypeName} · {formatarMoeda(item.totalPriceCents)}</li>)}</ul>
    {[...pacotes].map(([chave, grupo]) => <div key={chave} className="mt-4 rounded-xl border border-[#d9ddcf] p-3 text-sm">
      <p className="font-semibold">{`${grupo.grupos.size} ${grupo.grupos.size === 1 ? "pacote" : "pacotes"} · ${grupo.evidencia.nomeTipo}`}</p>
      <p className="mt-1">{`${grupo.itens.length} lugares · ${formatarMoeda(grupo.itens.reduce((soma, item) => soma + item.totalPriceCents, 0))}`}</p>
      <p className="mt-1 text-[#647066]">{`Preço por pacote: ${formatarMoeda(grupo.evidencia.precoPacoteCentavos)} (antes do cupom)`}</p>
      <p className="mt-1 text-[#647066]">Lugares: {grupo.itens.map(item => `${item.rowLabel}${item.seatNumber}`).join(", ")}</p>
    </div>)}
    {pedido.appliedOffer && <p className="mt-4 text-sm text-[#475248]">Oferta automática: <strong>{pedido.appliedOffer.name}</strong></p>}
    {pedido.appliedCoupon && <p className="mt-1 text-sm text-[#475248]">Cupom: <strong>{pedido.appliedCoupon.code}</strong></p>}
  </>;
}

function TotaisResumo({ pedido }: Pick<Props, "pedido">): React.JSX.Element {
  return <>
    <dl className="mt-4 space-y-1 border-t border-[#e6e9e1] pt-4 text-sm text-[#475248]"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatarMoeda(pedido.subtotalCents)}</dd></div>{(pedido.appliedOffer || pedido.offerDiscountCents > 0) && <div className="flex justify-between"><dt>Desconto da oferta</dt><dd>{pedido.offerDiscountCents > 0 ? `-${formatarMoeda(pedido.offerDiscountCents)}` : formatarMoeda(0)}</dd></div>}{(pedido.appliedCoupon || pedido.couponDiscountCents > 0) && <div className="flex justify-between"><dt>Desconto do cupom</dt><dd>{pedido.couponDiscountCents > 0 ? `-${formatarMoeda(pedido.couponDiscountCents)}` : formatarMoeda(0)}</dd></div>}<div className="flex justify-between"><dt>Desconto total</dt><dd>{pedido.discountCents > 0 ? `-${formatarMoeda(pedido.discountCents)}` : formatarMoeda(0)}</dd></div><div className="mt-2 flex justify-between text-base font-semibold text-[#1f2a24]"><dt>Total</dt><dd>{formatarMoeda(pedido.totalCents)}</dd></div></dl>
    {pedido.totalCents === 0 && <p role="status" className="mt-3 rounded-lg bg-[#f1f7e9] p-3 text-sm text-[#3f6f12]"><strong>Pedido gratuito</strong> — você não precisará informar pagamento.</p>}
  </>;
}

// Um único cartão para celular e computador: no celular os detalhes ficam recolhidos,
// mas o cupom e os totais ficam sempre à vista para o desconto aparecer na hora.
export function ResumoPedido({ pedido, evento, sessao, mapHref = "#", onAlterar, onAtualizar = () => undefined, alterando = false, permitirCupom = true }: Props): React.JSX.Element {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const idDetalhes = useId();
  const lugares = pedido.items.map((item) => `${item.rowLabel}${item.seatNumber}`).join(", ");
  return <aside aria-label="Resumo do pedido" className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
    <div className="rounded-2xl border border-[#e6e9e1] bg-white shadow-sm">
      <button type="button" aria-expanded={detalhesAbertos} aria-controls={idDetalhes} onClick={() => setDetalhesAbertos((aberto) => !aberto)} className="flex w-full items-center justify-between gap-3 p-4 text-left font-semibold text-[#1f2a24] lg:hidden"><span>{pedido.items.length} {pedido.items.length === 1 ? "lugar" : "lugares"} · {lugares}</span><span className="shrink-0 text-sm text-[#3f6f12]">{detalhesAbertos ? "Ocultar detalhes ▴" : "Ver detalhes ▾"}</span></button>
      <div className="px-5 pb-5 lg:pt-5">
        <div id={idDetalhes} className={`${detalhesAbertos ? "block border-t border-[#e6e9e1] pt-4" : "hidden"} lg:block lg:border-t-0 lg:pt-0`}><DetalhesResumo pedido={pedido} evento={evento} sessao={sessao} /></div>
        {permitirCupom && <CupomPedido pedido={pedido} onAtualizar={onAtualizar} />}
        <TotaisResumo pedido={pedido} />
      </div>
    </div>
    <a href={mapHref} aria-disabled={alterando} onClick={(event) => { event.preventDefault(); if (!alterando) onAlterar(); }} className="mt-3 inline-flex min-h-10 items-center font-semibold text-[#3f6f12] underline aria-disabled:opacity-60">{alterando ? "Liberando lugares…" : "Alterar lugares"}</a>
  </aside>;
}
