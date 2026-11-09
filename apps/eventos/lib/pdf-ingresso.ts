import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { IngressoPublico, PedidoComIngressos } from "@essencia/shared/types";
import { formatarNumeroIngresso } from "@essencia/shared/eventos/ingresso";
import { formatarDataHoraExtenso } from "./eventos-formatters";

type OpcoesPdf = { carregarArte?: (url: string) => Promise<string | null> };

function origemDaPagina(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

function urlArte(imageUrl: string): string {
  return `${origemDaPagina()}/_next/image?url=${encodeURIComponent(imageUrl)}&w=640&q=75`;
}

async function carregarArtePadrao(imageUrl: string): Promise<string | null> {
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

function textoIngresso(pedido: PedidoComIngressos, ingresso: IngressoPublico): string[] {
  return [
    pedido.event.title,
    formatarDataHoraExtenso(pedido.session.startsAt, pedido.session.endsAt),
    pedido.event.locationName ?? "Local a confirmar",
    `Fileira ${ingresso.rowLabel} · Assento ${ingresso.seatNumber}`,
    `Ingresso ${ingresso.ticketTypeName}`,
    `Participante: ${ingresso.participantName}`,
    `Número do ingresso: ${formatarNumeroIngresso(ingresso.numero)}`,
    "Na entrada, mostre o QR code ou informe o número.",
  ];
}

export async function gerarPdfIngressos(pedido: PedidoComIngressos, ingressos: IngressoPublico[], opcoes: OpcoesPdf = {}): Promise<Blob> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const largura = pdf.internal.pageSize.getWidth();
  const carregarArte = opcoes.carregarArte ?? carregarArtePadrao;

  for (const [indice, ingresso] of ingressos.entries()) {
    if (indice > 0) pdf.addPage("a5", "portrait");
    pdf.setFillColor(247, 250, 242);
    pdf.roundedRect(10, 10, largura - 20, 190, 5, 5, "F");
    pdf.setTextColor(31, 42, 36);
    pdf.setFontSize(18);
    pdf.text("Ingresso", 16, 24);
    pdf.setFontSize(13);
    pdf.text(textoIngresso(pedido, ingresso), 16, 36, { maxWidth: largura - 48, lineHeightFactor: 1.65 });

    if (pedido.event.imageUrl) {
      try {
        const arte = await carregarArte(pedido.event.imageUrl);
        if (arte) pdf.addImage(arte, "JPEG", largura - 52, 16, 36, 24, undefined, "FAST");
      } catch {
        // A arte é opcional: o ingresso continua válido sem ela.
      }
    }

    pdf.setDrawColor(63, 111, 18);
    pdf.rect(16, 120, largura - 32, 46);
    try {
      const qr = await QRCode.toDataURL(ingresso.qrPayload, { margin: 1, width: 180 });
      pdf.addImage(qr, "PNG", 22, 124, 30, 30, undefined, "FAST");
    } catch {
      // O número continua sendo uma alternativa válida se o QR falhar.
    }
    pdf.setFontSize(10);
    pdf.text("Na entrada, mostre o QR code ou informe o número.", 58, 132, { maxWidth: largura - 76 });
    pdf.setFontSize(16);
    pdf.text(formatarNumeroIngresso(ingresso.numero), 22, 150);
    pdf.setFontSize(9);
    pdf.text(`Pedido nº ${pedido.orderNumber}`, 22, 160);
  }

  return pdf.output("blob");
}

export function nomeArquivoIngresso(pedido: PedidoComIngressos, ingresso?: IngressoPublico): string {
  return ingresso ? `ingresso-${pedido.orderNumber}-${formatarNumeroIngresso(ingresso.numero)}.pdf` : `ingressos-${pedido.orderNumber}.pdf`;
}

export async function compartilharOuBaixar(arquivo: File, navegador?: Pick<Navigator, "canShare" | "share">): Promise<"compartilhado" | "baixado"> {
  const alvo = navegador ?? (typeof navigator !== "undefined" ? navigator : undefined);
  if (alvo?.canShare?.({ files: [arquivo] }) && alvo.share) {
    await alvo.share({ files: [arquivo] });
    return "compartilhado";
  }
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = arquivo.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return "baixado";
}
