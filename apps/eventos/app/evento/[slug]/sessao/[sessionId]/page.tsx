import { EscolhaTipoIngresso } from "../../../../../components/escolha-tipo-ingresso";
import { MapaAssentos } from "../../../../../components/mapa-assentos";
import { listarSessoesPublicas, obterMapaSessao } from "../../../../../lib/eventos-api";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string; sessionId: string }>; searchParams?: Promise<{ ticketTypeId?: string }> }) {
  const { slug, sessionId } = await params;
  const query = searchParams ? await searchParams : {};
  const sessions = await listarSessoesPublicas(slug);
  const session = sessions.find((item) => item.id === sessionId);
  if (!session || session.availability !== "available" || !session.ticketTypes.length || !session.mapId) return <p role="alert" className="rounded border border-red-300 bg-red-50 p-4">Não há ingressos disponíveis para esta sessão.</p>;
  const requestedTicketTypeId = session.ticketTypes.find((type) => type.id === query.ticketTypeId)?.id;
  const selectedTicketTypeId = requestedTicketTypeId || (session?.ticketTypes.length === 1 ? session.ticketTypes[0].id : undefined);
  if (!selectedTicketTypeId) return <EscolhaTipoIngresso eventSlug={slug} sessionId={sessionId} ticketTypes={session.ticketTypes} />;
  const map = await obterMapaSessao(sessionId);
  return <><h1 className="text-2xl font-bold">Escolha seus assentos</h1><p className="my-2 text-slate-600">Você poderá escolher o tipo de ingresso de cada assento no resumo.</p><p className="my-4 text-slate-600">Assentos cinza estão indisponíveis. No celular, comece pela lista e escolha uma fileira para encontrar seu lugar.</p><MapaAssentos map={map} checkoutHref={`/checkout?slug=${encodeURIComponent(slug)}`} ticketTypes={session.ticketTypes} initialTicketTypeId={selectedTicketTypeId} /></>;
}
