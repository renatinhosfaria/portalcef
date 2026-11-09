import React from "react";
import { FluxoCheckout } from "../../components/checkout/fluxo-checkout";
import { listarPoliticasPublicasServidor, listarSessoesPublicasServidor, obterEventoPublicoServidor, consultarPedidoServidor } from "../../lib/eventos-api-servidor";

export const dynamic = "force-dynamic";

type Params = Promise<{ pedido?: string; slug?: string; sessionId?: string }>;

export default async function Page({ searchParams }: { searchParams: Params }): Promise<React.JSX.Element> {
  const query = await searchParams;
  if (!query.pedido || !query.slug || !query.sessionId) return <section role="alert" className="content-width py-8"><h1 className="mb-3 text-2xl font-semibold">Checkout indisponível</h1><p>Não foi possível identificar o pedido e a sessão.</p></section>;
  const [pedido, evento, sessoes, politicas] = await Promise.all([
    consultarPedidoServidor(query.pedido).catch(() => null),
    obterEventoPublicoServidor(query.slug).catch(() => null),
    listarSessoesPublicasServidor(query.slug).catch(() => []),
    listarPoliticasPublicasServidor(query.slug).catch(() => []),
  ]);
  const sessao = sessoes.find((item) => item.id === query.sessionId) ?? sessoes.find((item) => item.id === pedido?.sessionId);
  if (!pedido || !evento || !sessao) return <section role="alert" className="content-width py-8"><h1 className="mb-3 text-2xl font-semibold">Checkout indisponível</h1><p>Não foi possível carregar os dados da reserva.</p></section>;
  return <FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey={process.env.STRIPE_PUBLISHABLE_KEY ?? null} />;
}
