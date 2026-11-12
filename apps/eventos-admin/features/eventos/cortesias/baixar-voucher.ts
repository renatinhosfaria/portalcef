import type { CortesiaResumo } from "@essencia/shared/types";
import { gerarPdfIngressos, nomeArquivoIngresso } from "@essencia/components/eventos/pdf-ingresso";
import { obterVoucher } from "./api-cortesias";

export async function carregarArteAdmin(imageUrl: string): Promise<string | null> {
  try {
    const resposta = await fetch(`/eventos-admin/_next/image?url=${encodeURIComponent(imageUrl)}&w=640&q=75`, { credentials: "include" });
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    return await new Promise<string | null>((resolve) => { const leitor = new FileReader(); leitor.onload = () => resolve(typeof leitor.result === "string" ? leitor.result : null); leitor.onerror = () => resolve(null); leitor.readAsDataURL(blob); });
  } catch { return null; }
}

export async function baixarVoucher(eventId: string, cortesia: CortesiaResumo): Promise<void> {
  const pedido = await obterVoucher(eventId, cortesia.orderId);
  const ingresso = pedido.tickets[0];
  const blob = await gerarPdfIngressos(pedido, pedido.tickets, { carregarArte: carregarArteAdmin });
  const arquivo = new File([blob], nomeArquivoIngresso(pedido, ingresso), { type: "application/pdf" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url; link.download = arquivo.name; link.rel = "noopener"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
