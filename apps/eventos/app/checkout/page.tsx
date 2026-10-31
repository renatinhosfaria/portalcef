import { FormularioCheckout } from "../../components/formulario-checkout";
import { listarPoliticasPublicas } from "../../lib/eventos-api";

type Params = Promise<{ assentos?: string; ticketTypeIds?: string; ticketTypeId?: string; sessionId?: string; slug?: string }>;

function lerLista(valor?: string) {
  return valor?.split(",").map((item) => decodeURIComponent(item)).filter(Boolean) ?? [];
}

export default async function Page({ searchParams }: { searchParams: Params }) {
  const query = await searchParams;
  const seatIds = lerLista(query.assentos);
  const ticketTypeIds = lerLista(query.ticketTypeIds);
  if (!ticketTypeIds.length && query.ticketTypeId) ticketTypeIds.push(query.ticketTypeId);
  const politicas = query.slug ? await listarPoliticasPublicas(query.slug).catch(() => []) : [];
  return <><h1 className="mb-6 text-2xl font-bold">Checkout</h1><p className="mb-5 text-slate-600">Você está reservando {seatIds.length} assento(s). O pagamento será concluído em ambiente seguro.</p><FormularioCheckout seatIds={seatIds} ticketTypeIds={ticketTypeIds} sessionId={query.sessionId} politicas={politicas} /></>;
}
