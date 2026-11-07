import React from "react";
import { FormularioCheckout } from "../../components/formulario-checkout";
import { listarPoliticasPublicas, listarSessoesPublicas, obterEventoPublico } from "../../lib/eventos-api";
import { lerListaQuery, montarHrefRetornoMapa, normalizarTiposPorAssento } from "../../lib/checkout-utils";

type Params = Promise<{ assentos?: string; ticketTypeIds?: string; ticketTypeId?: string; sessionId?: string; slug?: string }>;

export default async function Page({ searchParams }: { searchParams: Params }) {
  const query = await searchParams;
  const assentosInformados = lerListaQuery(query.assentos);
  const tiposInformados = lerListaQuery(query.ticketTypeIds);
  const seatIds = assentosInformados.values;
  const ticketTypeIdsInformados = tiposInformados.values;
  if (!ticketTypeIdsInformados.length && query.ticketTypeId) ticketTypeIdsInformados.push(query.ticketTypeId);
  let ticketTypeIds: string[] = [];
  let erroSelecao: string | null = assentosInformados.invalid || tiposInformados.invalid
    ? "Não foi possível interpretar a seleção de assentos informada."
    : null;
  if (!erroSelecao) {
    try {
      ticketTypeIds = normalizarTiposPorAssento(seatIds, ticketTypeIdsInformados);
    } catch (error) {
      erroSelecao = error instanceof Error ? error.message : "Não foi possível validar os tipos de ingresso selecionados.";
    }
  }
  const [politicas, evento, sessoes] = query.slug ? await Promise.all([
    listarPoliticasPublicas(query.slug).catch(() => []),
    obterEventoPublico(query.slug).catch(() => null),
    listarSessoesPublicas(query.slug).catch(() => []),
  ]) : [[], null, []];
  const sessao = query.sessionId ? sessoes.find((item) => item.id === query.sessionId) : undefined;
  const mapHref = query.slug && query.sessionId
    ? montarHrefRetornoMapa({ slug: query.slug, sessionId: query.sessionId, seatIds, ticketTypeIds, motivo: "disponibilidade" })
    : undefined;
  return <><h1 className="mb-6 text-2xl font-bold">Checkout</h1><p className="mb-5 text-slate-600">Você está reservando {seatIds.length} assento(s). O pagamento será concluído em ambiente seguro.</p>{erroSelecao ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-red-800">{erroSelecao} Volte ao mapa e selecione os ingressos novamente.</p> : <FormularioCheckout seatIds={seatIds} ticketTypeIds={ticketTypeIds} sessionId={query.sessionId} mapHref={mapHref} event={evento ? { title: evento.title, startsAt: evento.startsAt, locationName: evento.locationName } : undefined} session={sessao} offers={sessao?.offers} politicas={politicas} />}</>;
}
