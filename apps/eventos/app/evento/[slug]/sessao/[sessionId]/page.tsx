import Link from "next/link";
import { MapaAssentos } from "../../../../../components/mapa-assentos";
import { listarSessoesPublicas, obterMapaSessao } from "../../../../../lib/eventos-api";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string; sessionId: string }>; searchParams?: Promise<{ ticketTypeId?: string }> }) {
  const { slug, sessionId } = await params;
  const query = searchParams ? await searchParams : {};
  const [map, sessions] = await Promise.all([obterMapaSessao(sessionId), listarSessoesPublicas(slug)]);
  const session = sessions.find((item) => item.id === sessionId);
  const requestedTicketTypeId = session?.ticketTypes.find((type) => type.id === query.ticketTypeId)?.id;
  const selectedTicketTypeId = requestedTicketTypeId || (session?.ticketTypes.length === 1 ? session.ticketTypes[0].id : undefined);
  if (!session || !session.ticketTypes.length) return <p role="alert" className="rounded border border-red-300 bg-red-50 p-4">Não há ingressos disponíveis para esta sessão.</p>;
  if (!selectedTicketTypeId) return <section className="space-y-4"><h1 className="text-2xl font-bold">Escolha o tipo de ingresso</h1><p className="text-slate-600">Selecione uma opção antes de escolher seus assentos.</p><ul className="space-y-2">{session.ticketTypes.map((type) => <li key={type.id}><Link className="text-blue-700 underline" href={`/evento/${slug}/sessao/${sessionId}?ticketTypeId=${encodeURIComponent(type.id)}`}>{type.name} · R$ {(type.priceCents / 100).toFixed(2).replace(".", ",")}</Link></li>)}</ul></section>;
  return <><h1 className="text-2xl font-bold">Escolha seus assentos</h1><p className="my-2 text-slate-600">Ingresso selecionado: {session.ticketTypes.find((type) => type.id === selectedTicketTypeId)?.name ?? "opção escolhida"}</p><p className="my-4 text-slate-600">Assentos cinza estão indisponíveis.</p><MapaAssentos map={map} checkoutHref={`/checkout?slug=${encodeURIComponent(slug)}`} ticketTypeId={selectedTicketTypeId} /></>;
}
