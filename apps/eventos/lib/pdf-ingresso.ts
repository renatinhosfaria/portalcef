export { compartilharOuBaixar, gerarPdfIngressos, nomeArquivoIngresso } from "@essencia/components/eventos/pdf-ingresso";
export type { CarregarArte } from "@essencia/components/eventos/pdf-ingresso";

function urlArte(imageUrl: string): string {
  const origem = typeof window === "undefined" ? "" : window.location.origin;
  return `${origem}/_next/image?url=${encodeURIComponent(imageUrl)}&w=640&q=75`;
}

export async function carregarArtePublica(imageUrl: string): Promise<string | null> {
  try {
    const resposta = await fetch(urlArte(imageUrl));
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    return await new Promise<string | null>((resolve) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(typeof leitor.result === "string" ? leitor.result : null);
      leitor.onerror = () => resolve(null);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
