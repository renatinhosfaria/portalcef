import { FormularioCheckout } from "../../components/formulario-checkout";
import { listarPoliticasPublicas } from "../../lib/eventos-api";

type Params = Promise<{ assentos?: string; ticketTypeId?: string; sessionId?: string; slug?: string }>;

export default async function Page({ searchParams }: { searchParams: Params }) {
  const query = await searchParams;
  const seatIds = query.assentos?.split(",").map((value) => decodeURIComponent(value)).filter(Boolean) ?? [];
  const ticketTypeIds = query.ticketTypeId ? [query.ticketTypeId] : [];
  const politicas = query.slug ? await listarPoliticasPublicas(query.slug).catch(() => []) : [];
  return <><h1 className="mb-6 text-2xl font-bold">Checkout</h1><p className="mb-5 text-slate-600">Você está reservando {seatIds.length} assento(s). O pagamento será concluído em ambiente seguro.</p><FormularioCheckout seatIds={seatIds} ticketTypeIds={ticketTypeIds} sessionId={query.sessionId} politicas={politicas} /></>;
}
