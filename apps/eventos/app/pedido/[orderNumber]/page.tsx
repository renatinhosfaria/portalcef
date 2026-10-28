import { ConsultaPedido } from "../../../components/consulta-pedido";
import { consultarPedido } from "../../../lib/eventos-api";

export default async function Page({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams?: Promise<{ retorno?: string }> }) {
  const { orderNumber } = await params;
  const query = searchParams ? await searchParams : {};
  const initialResult = await consultarPedido(orderNumber).catch(() => null);
  return <><h1 className="mb-6 text-2xl font-bold">Consultar pedido</h1>{query.retorno === "sucesso" && <p className="mb-5 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">Pagamento recebido. Estamos aguardando a confirmação automática do webhook.</p>}{query.retorno === "cancelado" && <p className="mb-5 rounded border border-slate-300 bg-slate-50 p-3">O pagamento não foi concluído. Você pode consultar o pedido novamente.</p>}<ConsultaPedido initialOrderNumber={orderNumber} initialResult={initialResult} /></>;
}
