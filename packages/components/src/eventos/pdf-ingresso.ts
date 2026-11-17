import { GState, jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { IngressoPublico, PedidoComIngressos } from "@essencia/shared/types";
import { formatarNumeroIngresso } from "@essencia/shared/eventos/ingresso";
import { formatarDataHoraExtenso } from "@essencia/shared/eventos/datas";

export type CarregarArte = (imageUrl: string) => Promise<string | null>;
export type VariantePdfIngresso = "INGRESSO" | "CORTESIA";
export type OpcoesPdfIngresso = { carregarArte: CarregarArte; variante?: VariantePdfIngresso };

export type ItemLotePdf = { pedido: PedidoComIngressos; ingressos: IngressoPublico[] };

export async function gerarPdfIngressos(pedido: PedidoComIngressos, ingressos: IngressoPublico[], opcoes: OpcoesPdfIngresso): Promise<Blob> {
  return gerarPdfLoteIngressos([{ pedido, ingressos }], opcoes);
}

/** Gera um único PDF com os ingressos de vários pedidos, uma página por ingresso. */
export async function gerarPdfLoteIngressos(itens: ItemLotePdf[], opcoes: OpcoesPdfIngresso): Promise<Blob> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const variante = opcoes.variante ?? "INGRESSO";
  // A arte costuma ser a mesma para todas as páginas: carrega uma vez por URL.
  const artes = new Map<string, Promise<string | null>>();
  const carregarArte = (url: string): Promise<string | null> => {
    let arte = artes.get(url);
    if (!arte) {
      arte = opcoes.carregarArte(url).catch(() => null);
      artes.set(url, arte);
    }
    return arte;
  };

  let primeiraPagina = true;
  for (const { pedido, ingressos } of itens) {
    for (const ingresso of ingressos) {
      if (!primeiraPagina) pdf.addPage("a5", "portrait");
      primeiraPagina = false;
      const arte = pedido.event.imageUrl ? await carregarArte(pedido.event.imageUrl) : null;
      let qr: string | null = null;
      try {
        qr = await QRCode.toDataURL(ingresso.qrPayload, { margin: 1, width: 360 });
      } catch {
        // O número continua sendo uma alternativa válida se o QR falhar.
      }
      desenharCartao(pdf, { pedido, ingresso, variante, arte, qr });
    }
  }

  return pdf.output("blob");
}

type Cor = readonly [number, number, number];
const TINTA: Cor = [31, 42, 36];
const TINTA_2: Cor = [91, 102, 96];
const LINHA: Cor = [230, 233, 225];
const SUPERFICIE: Cor = [245, 243, 237];
const ACAO: Cor = [63, 111, 18];
const BRANCO: Cor = [255, 255, 255];
const PT_PARA_MM = 0.3528;

function alturaLinha(tamanhoFonte: number): number {
  return tamanhoFonte * PT_PARA_MM * 1.25;
}

type DadosCartao = { pedido: PedidoComIngressos; ingresso: IngressoPublico; variante: VariantePdfIngresso; arte: string | null; qr: string | null };

/** Desenha um ingresso com o mesmo visual do cartão exibido na tela de ingressos. */
function desenharCartao(pdf: jsPDF, { pedido, ingresso, variante, arte, qr }: DadosCartao): void {
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const x = 14;
  const largura = larguraPagina - 28;
  const topo = 12;
  const margem = 6;
  const xConteudo = x + margem;
  const larguraConteudo = largura - margem * 2;
  const centro = x + largura / 2;

  // Medidas do topo escuro, que cresce quando o título ocupa mais linhas.
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  const linhasTitulo: string[] = pdf.splitTextToSize(pedido.event.title, larguraConteudo);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const linhasInfo: string[] = [
    ...pdf.splitTextToSize(formatarDataHoraExtenso(pedido.session.startsAt, pedido.session.endsAt), larguraConteudo),
    ...pdf.splitTextToSize(pedido.event.locationName ?? "Local a confirmar", larguraConteudo),
  ];
  const alturaSelo = variante === "CORTESIA" ? 9 : 0;
  const alturaTextoTopo = alturaSelo + linhasTitulo.length * alturaLinha(15) + 1 + linhasInfo.length * alturaLinha(10);
  const alturaTopo = Math.max(42, alturaTextoTopo + margem * 2);

  // Medidas do corpo.
  const yQuadros = topo + alturaTopo + margem;
  const alturaQuadro = 20;
  const tamanhoQr = 52;
  const yQr = yQuadros + alturaQuadro + 6;
  pdf.setFontSize(9);
  const instrucao: string[] = pdf.splitTextToSize("Na entrada, mostre o QR code ou informe o número.", 80);
  const yInstrucao = yQr + tamanhoQr + 5;
  const yDivisoria = yInstrucao + (instrucao.length - 1) * alturaLinha(9) + 5;
  const linhasDetalhe: [string, string, "courier" | "helvetica"][] = [
    ["Número do ingresso", formatarNumeroIngresso(ingresso.numero), "courier"],
    ["Participante", ingresso.participantName, "helvetica"],
    ["Pedido nº", pedido.orderNumber, "helvetica"],
  ];
  const yPrimeiroDetalhe = yDivisoria + 7;
  const espacoDetalhe = 6.5;
  const alturaCartao = yPrimeiroDetalhe + (linhasDetalhe.length - 1) * espacoDetalhe + margem - topo;

  // Fundo branco com borda, como o cartão da tela.
  pdf.setFillColor(...BRANCO);
  pdf.setDrawColor(...LINHA);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, topo, largura, alturaCartao, 6, 6, "FD");

  // Topo escuro com a arte esmaecida, recortado pelos cantos arredondados do cartão.
  pdf.saveGraphicsState();
  pdf.roundedRect(x, topo, largura, alturaCartao, 6, 6, null);
  pdf.clip();
  pdf.discardPath();
  pdf.setFillColor(...TINTA);
  pdf.rect(x, topo, largura, alturaTopo, "F");
  if (arte) {
    try {
      const { width, height } = pdf.getImageProperties(arte);
      const escala = Math.max(largura / width, alturaTopo / height);
      const w = width * escala;
      const h = height * escala;
      pdf.saveGraphicsState();
      pdf.rect(x, topo, largura, alturaTopo, null);
      pdf.clip();
      pdf.discardPath();
      pdf.setGState(new GState({ opacity: 0.22 }));
      pdf.addImage(arte, "JPEG", x + (largura - w) / 2, topo + (alturaTopo - h) / 2, w, h, undefined, "FAST");
      pdf.restoreGraphicsState();
    } catch {
      // A arte é opcional: o ingresso continua válido sem ela.
    }
  }
  pdf.restoreGraphicsState();

  // Textos do topo, alinhados à base como no cartão.
  let y = topo + alturaTopo - margem - alturaTextoTopo;
  if (variante === "CORTESIA") {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    const larguraSelo = pdf.getTextWidth("CORTESIA") + 6;
    pdf.setFillColor(...BRANCO);
    pdf.roundedRect(xConteudo, y, larguraSelo, 5.5, 2.75, 2.75, "F");
    pdf.setTextColor(...ACAO);
    pdf.text("CORTESIA", xConteudo + 3, y + 3.85);
    y += alturaSelo;
  }
  pdf.setTextColor(...BRANCO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  for (const linha of linhasTitulo) {
    y += alturaLinha(15);
    pdf.text(linha, xConteudo, y - 1.4);
  }
  y += 1;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(232, 236, 233);
  for (const linha of linhasInfo) {
    y += alturaLinha(10);
    pdf.text(linha, xConteudo, y - 1);
  }

  // Quadros de fileira, assento e tipo de ingresso.
  const espaco = 3;
  const larguraQuadro = (larguraConteudo - espaco * 2) / 3;
  const quadros: [string, string, number][] = [
    ["FILEIRA", ingresso.rowLabel, 18],
    ["ASSENTO", ingresso.seatNumber, 18],
    ["INGRESSO", ingresso.ticketTypeName, 10],
  ];
  quadros.forEach(([rotulo, valor, tamanho], indice) => {
    const xq = xConteudo + indice * (larguraQuadro + espaco);
    const cq = xq + larguraQuadro / 2;
    pdf.setFillColor(...SUPERFICIE);
    pdf.roundedRect(xq, yQuadros, larguraQuadro, alturaQuadro, 3, 3, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...TINTA_2);
    pdf.text(rotulo, cq, yQuadros + 6, { align: "center", charSpace: 0.3 });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(tamanho);
    pdf.setTextColor(...TINTA);
    const linhas: string[] = pdf.splitTextToSize(valor, larguraQuadro - 4).slice(0, 2);
    const base = linhas.length > 1 ? yQuadros + 12 : yQuadros + (tamanho > 12 ? 15.5 : 14);
    linhas.forEach((linha, i) => pdf.text(linha, cq, base + i * alturaLinha(tamanho), { align: "center" }));
  });

  // QR code centralizado e instrução logo abaixo.
  if (qr) pdf.addImage(qr, "PNG", centro - tamanhoQr / 2, yQr, tamanhoQr, tamanhoQr, undefined, "FAST");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...TINTA_2);
  pdf.text(instrucao, centro, yInstrucao, { align: "center", lineHeightFactor: 1.25 });

  // Divisória e detalhes em duas colunas.
  pdf.setDrawColor(...LINHA);
  pdf.line(xConteudo, yDivisoria, xConteudo + larguraConteudo, yDivisoria);
  linhasDetalhe.forEach(([rotulo, valor, fonte], indice) => {
    const yl = yPrimeiroDetalhe + indice * espacoDetalhe;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...TINTA_2);
    pdf.text(rotulo, xConteudo, yl);
    pdf.setFont(fonte, "bold");
    pdf.setFontSize(fonte === "courier" ? 10 : 9);
    pdf.setTextColor(...TINTA);
    const [texto = ""] = pdf.splitTextToSize(valor, larguraConteudo - 38) as string[];
    pdf.text(texto, xConteudo + larguraConteudo, yl, { align: "right" });
  });
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
