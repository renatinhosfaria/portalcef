import React from "react";
import { MeusIngressos } from "../../../components/ingressos/meus-ingressos";
import { PaginaIngressos } from "../../../components/ingressos/pagina-ingressos";
import { EventosApiError } from "../../../lib/eventos-api";
import { obterIngressosServidor } from "../../../lib/eventos-api-servidor";

export default async function Page({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams?: Promise<{ retorno?: string; acesso?: string }> }) {
  const { orderNumber } = await params;
  const query = searchParams ? await searchParams : {};
  const acesso = query.acesso?.trim() ?? "";
  if (!acesso) return <section className="content-narrow space-y-5 py-12"><h1 className="font-display text-2xl font-bold">Meus ingressos</h1><MeusIngressos numeroInicial={orderNumber} /></section>;
  try {
    const inicial = await obterIngressosServidor(orderNumber, acesso);
    return <PaginaIngressos inicial={inicial} orderNumber={orderNumber} acesso={acesso} />;
  } catch (erro) {
    if (erro instanceof EventosApiError && erro.status === 404) {
      return <section className="content-narrow space-y-5 py-12"><h1 className="font-display text-2xl font-bold">Não conseguimos abrir seus ingressos por este link.</h1><MeusIngressos numeroInicial={orderNumber} /></section>;
    }
    return <section className="content-narrow space-y-5 py-12"><h1 className="font-display text-2xl font-bold">Não foi possível carregar seus ingressos.</h1><MeusIngressos numeroInicial={orderNumber} /></section>;
  }
}
