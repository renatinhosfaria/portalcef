"use client";

import React, { useState } from "react";
import type { IngressoPublico, PedidoComIngressos } from "@essencia/shared/types";
import { compartilharOuBaixar, gerarPdfIngressos, nomeArquivoIngresso } from "../../lib/pdf-ingresso";
import { classeBotaoAcao } from "../base/botao-acao";

export function AcoesIngresso({ pedido, ingresso, indice: _indice, total: _total }: { pedido: PedidoComIngressos; ingresso: IngressoPublico; indice: number; total: number }): React.JSX.Element {
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  async function compartilhar() {
    setCarregando(true);
    setResultado(null);
    try {
      const blob = await gerarPdfIngressos(pedido, [ingresso]);
      const arquivo = new File([blob], nomeArquivoIngresso(pedido, ingresso), { type: "application/pdf" });
      const acao = await compartilharOuBaixar(arquivo);
      setResultado(acao === "compartilhado" ? "Ingresso compartilhado." : "Download iniciado.");
    } catch {
      setResultado("Não foi possível preparar o ingresso.");
    } finally {
      setCarregando(false);
    }
  }
  return <div className="flex flex-wrap items-center gap-2 print:hidden"><button type="button" className={classeBotaoAcao("secundaria")} onClick={compartilhar} disabled={carregando}>{carregando ? "Preparando…" : "Compartilhar"}</button>{resultado ? <span role="status" className="text-sm text-[var(--tinta-2)]">{resultado}</span> : null}</div>;
}
