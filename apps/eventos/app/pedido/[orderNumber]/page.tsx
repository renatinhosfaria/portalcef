import { ConsultaPedido } from "../../../components/consulta-pedido";
import { consultarPedido } from "../../../lib/eventos-api";

export default async function Page({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams?: Promise<{ retorno?: string }> }) {
  const { orderNumber } = await params;
  const query = searchParams ? await searchParams : {};
  const initialResult = await consultarPedido(orderNumber).catch(() => null);
  const retorno = query.retorno === "sucesso" || query.retorno === "cancelado" ? query.retorno : undefined;
  return <><h1 className="mb-6 text-2xl font-bold">Consultar pedido</h1><ConsultaPedido initialOrderNumber={orderNumber} initialResult={initialResult} autoAtualizar={retorno === "sucesso"} retorno={retorno} /></>;
}
