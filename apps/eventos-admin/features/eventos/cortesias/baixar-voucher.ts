import type { CortesiaResumo, PedidoComIngressos } from "@essencia/shared/types";
import { compartilharOuBaixar, gerarPdfIngressos, gerarPdfLoteIngressos, nomeArquivoIngresso } from "@essencia/components/eventos/pdf-ingresso";
import { obterVoucher } from "./api-cortesias";

const BUSCAS_SIMULTANEAS = 5;

export async function carregarArteAdmin(imageUrl: string): Promise<string | null> {
  try {
    const resposta = await fetch(`/eventos-admin/_next/image?url=${encodeURIComponent(imageUrl)}&w=640&q=75`, { credentials: "include" });
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    return await new Promise<string | null>((resolve) => { const leitor = new FileReader(); leitor.onload = () => resolve(typeof leitor.result === "string" ? leitor.result : null); leitor.onerror = () => resolve(null); leitor.readAsDataURL(blob); });
  } catch { return null; }
}

function slug(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Usa o nome do grupo quando todas as cortesias são do mesmo grupo. */
export function nomeArquivoCortesias(cortesias: Pick<CortesiaResumo, "grupo">[]): string {
  const grupos = new Set(cortesias.map((cortesia) => slug(cortesia.grupo)));
  const [grupo] = grupos;
  return grupos.size === 1 && grupo ? `cortesias-${grupo}-${cortesias.length}.pdf` : `cortesias-${cortesias.length}.pdf`;
}

export async function compartilharVoucher(eventId: string, cortesia: CortesiaResumo): Promise<void> {
  const pedido = await obterVoucher(eventId, cortesia.orderId);
  const ingresso = pedido.tickets[0];
  const blob = await gerarPdfIngressos(pedido, pedido.tickets, { carregarArte: carregarArteAdmin, variante: "CORTESIA" });
  await compartilharOuBaixar(new File([blob], nomeArquivoIngresso(pedido, ingresso), { type: "application/pdf" }));
}

/** Junta as cortesias escolhidas num único PDF, uma página por ingresso. */
export async function compartilharCortesiasAgrupadas(eventId: string, cortesias: CortesiaResumo[]): Promise<void> {
  const pedidos: PedidoComIngressos[] = [];
  for (let inicio = 0; inicio < cortesias.length; inicio += BUSCAS_SIMULTANEAS) {
    const fatia = cortesias.slice(inicio, inicio + BUSCAS_SIMULTANEAS);
    pedidos.push(...(await Promise.all(fatia.map((cortesia) => obterVoucher(eventId, cortesia.orderId)))));
  }
  const blob = await gerarPdfLoteIngressos(pedidos.map((pedido) => ({ pedido, ingressos: pedido.tickets })), { carregarArte: carregarArteAdmin, variante: "CORTESIA" });
  await compartilharOuBaixar(new File([blob], nomeArquivoCortesias(cortesias), { type: "application/pdf" }));
}
