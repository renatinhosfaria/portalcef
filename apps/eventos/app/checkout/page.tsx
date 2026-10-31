import { FormularioCheckout } from "../../components/formulario-checkout";
import { listarPoliticasPublicas } from "../../lib/eventos-api";

type Params = Promise<{ assentos?: string; ticketTypeIds?: string; ticketTypeId?: string; sessionId?: string; slug?: string }>;

export function normalizarTiposPorAssento(seatIds: string[], ticketTypeIds: string[]): string[] {
  if (seatIds.length === 0) {
    if (ticketTypeIds.length === 0) return [];
    throw new Error(`A quantidade de tipos de ingresso (${ticketTypeIds.length}) não corresponde aos assentos selecionados (0).`);
  }
  if (ticketTypeIds.length === seatIds.length) return ticketTypeIds;
  if (ticketTypeIds.length === 1 && ticketTypeIds[0]) return seatIds.map(() => ticketTypeIds[0]);
  throw new Error(`A quantidade de tipos de ingresso (${ticketTypeIds.length}) não corresponde aos assentos selecionados (${seatIds.length}).`);
}

function lerLista(valor?: string) {
  return valor?.split(",").map((item) => decodeURIComponent(item)).filter(Boolean) ?? [];
}

export default async function Page({ searchParams }: { searchParams: Params }) {
  const query = await searchParams;
  const seatIds = lerLista(query.assentos);
  const ticketTypeIdsInformados = lerLista(query.ticketTypeIds);
  if (!ticketTypeIdsInformados.length && query.ticketTypeId) ticketTypeIdsInformados.push(query.ticketTypeId);
  let ticketTypeIds: string[] = [];
  let erroSelecao: string | null = null;
  try {
    ticketTypeIds = normalizarTiposPorAssento(seatIds, ticketTypeIdsInformados);
  } catch (error) {
    erroSelecao = error instanceof Error ? error.message : "Não foi possível validar os tipos de ingresso selecionados.";
  }
  const politicas = query.slug ? await listarPoliticasPublicas(query.slug).catch(() => []) : [];
  return <><h1 className="mb-6 text-2xl font-bold">Checkout</h1><p className="mb-5 text-slate-600">Você está reservando {seatIds.length} assento(s). O pagamento será concluído em ambiente seguro.</p>{erroSelecao ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-red-800">{erroSelecao} Volte ao mapa e selecione os ingressos novamente.</p> : <FormularioCheckout seatIds={seatIds} ticketTypeIds={ticketTypeIds} sessionId={query.sessionId} politicas={politicas} />}</>;
}
