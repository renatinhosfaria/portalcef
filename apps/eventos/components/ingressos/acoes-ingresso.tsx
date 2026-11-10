"use client";

import React, { useState } from "react";
import type { IngressoPublico, PedidoComIngressos } from "@essencia/shared/types";
import { gerarPdfIngressos, nomeArquivoIngresso, urlWhatsAppIngresso } from "../../lib/pdf-ingresso";
import { classeBotaoAcao } from "../base/botao-acao";

export function AcoesIngresso({ pedido, ingresso, indice: _indice, total: _total }: { pedido: PedidoComIngressos; ingresso: IngressoPublico; indice: number; total: number }): React.JSX.Element {
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  async function baixar() {
    setCarregando(true);
    setResultado(null);
    try {
      const blob = await gerarPdfIngressos(pedido, [ingresso]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivoIngresso(pedido, ingresso);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setResultado("Download iniciado.");
    } catch {
      setResultado("Não foi possível preparar o ingresso.");
    } finally {
      setCarregando(false);
    }
  }
  function compartilharWhatsApp() {
    setResultado(null);
    const url = urlWhatsAppIngresso(pedido, ingresso, window.location.href);
    window.open(url, "_blank", "noopener,noreferrer");
    setResultado("WhatsApp aberto.");
  }
  return <div className="flex flex-wrap items-center gap-2 print:hidden"><button type="button" className={classeBotaoAcao("secundaria")} onClick={baixar} disabled={carregando}>{carregando ? "Preparando…" : "Baixar ingresso"}</button><button type="button" className={classeBotaoAcao("secundaria")} onClick={compartilharWhatsApp} disabled={carregando}>Compartilhar no WhatsApp</button>{resultado ? <span role="status" className="text-sm text-[var(--tinta-2)]">{resultado}</span> : null}</div>;
}
