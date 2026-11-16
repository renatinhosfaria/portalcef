"use client";

import React, { useEffect, useRef, useState } from "react";
import type { PedidoPublicoResult } from "@essencia/shared/types";
import { aplicarCupom, EventosApiError } from "../../lib/eventos-api";

type Props = { pedido: PedidoPublicoResult; onAtualizar: (pedido: PedidoPublicoResult) => void };

export function CupomPedido({ pedido, onAtualizar }: Props): React.JSX.Element {
  const [codigo, setCodigo] = useState(pedido.appliedCoupon?.code ?? "");
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<"aplicar" | "remover" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  // Recolhido por padrão para quem não tem cupom não achar que está pagando mais caro.
  const [aberto, setAberto] = useState(Boolean(pedido.appliedCoupon));
  const campoRef = useRef<HTMLInputElement>(null);
  const focarAoAbrirRef = useRef(false);

  useEffect(() => {
    setCodigo(pedido.appliedCoupon?.code ?? "");
    if (pedido.appliedCoupon) setAberto(true);
  }, [pedido.appliedCoupon?.code]);

  useEffect(() => {
    if (aberto && focarAoAbrirRef.current) {
      focarAoAbrirRef.current = false;
      campoRef.current?.focus();
    }
  }, [aberto]);

  async function enviar(codigoParaAplicar: string, acao: "aplicar" | "remover") {
    setErro(null);
    setMensagem(null);
    setAcaoEmAndamento(acao);
    try {
      const atualizado = await aplicarCupom(pedido.orderNumber, codigoParaAplicar.trim());
      onAtualizar(atualizado);
      setMensagem(acao === "remover" ? "Cupom removido." : "Cupom aplicado.");
      if (acao === "remover") setCodigo("");
    } catch (cause) {
      setErro(cause instanceof EventosApiError || cause instanceof Error ? cause.message : "Não foi possível aplicar o cupom.");
    } finally {
      setAcaoEmAndamento(null);
    }
  }

  const aplicado = pedido.appliedCoupon;
  if (!aberto) {
    return <div className="mt-4 border-t border-[#e6e9e1] pt-4">
      <button type="button" aria-expanded={false} onClick={() => { focarAoAbrirRef.current = true; setAberto(true); }} className="min-h-10 text-sm font-semibold text-[#3f6f12] underline">Tem um cupom de desconto?</button>
    </div>;
  }
  return <section className="mt-4 border-t border-[#e6e9e1] pt-4">
    <form onSubmit={(event) => { event.preventDefault(); if (codigo.trim()) void enviar(codigo, "aplicar"); }} className="space-y-2">
      <label htmlFor="codigo-cupom" className="block text-sm font-semibold text-[#1f2a24]">Cupom de desconto</label>
      <div className="flex gap-2">
        <input ref={campoRef} id="codigo-cupom" value={codigo} onChange={(event) => setCodigo(event.target.value)} disabled={acaoEmAndamento !== null} autoComplete="off" maxLength={80} className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#d9ddcf] px-3 text-sm" />
        <button type="submit" disabled={acaoEmAndamento !== null || !codigo.trim()} className="min-h-10 rounded-lg bg-[#3f6f12] px-3 text-sm font-semibold text-white disabled:opacity-60">{acaoEmAndamento === "aplicar" ? "Aplicando cupom…" : "Aplicar cupom"}</button>
      </div>
    </form>
    {aplicado && <button type="button" onClick={() => void enviar("", "remover")} disabled={acaoEmAndamento !== null} className="mt-2 text-sm font-semibold text-[#3f6f12] underline disabled:opacity-60">{acaoEmAndamento === "remover" ? "Removendo cupom…" : "Remover cupom"}</button>}
    {erro && <p role="alert" className="mt-2 text-sm text-[#8b1e1e]">{erro}</p>}
    {mensagem && <p role="status" className="mt-2 text-sm text-[#3f6f12]">{mensagem}</p>}
  </section>;
}
