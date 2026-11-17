import { GState, jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { IngressoPublico, PedidoComIngressos } from "@essencia/shared/types";
import {
  AVISOS_INGRESSO,
  coresClassificacaoEtaria,
  descreverClassificacaoEtaria,
  formatarNumeroIngresso,
  formatarValorIngresso,
  siglaClassificacaoEtaria,
} from "@essencia/shared/eventos/ingresso";
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

function corHex(hex: string): Cor {
  const valor = Number.parseInt(hex.replace("#", ""), 16);
  return [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255];
}

// Margens da folha e limites do QR, que é o único elemento que encolhe para o cartão caber.
const TOPO_CARTAO = 10;
const MARGEM_INFERIOR = 10;
const QR_PADRAO = 52;
const QR_MINIMO = 40;

// Selo da classificação indicativa, na linha abaixo do local.
const SELO_CLASSIFICACAO = 4.6;
const ESPACO_ANTES_CLASSIFICACAO = 1.2;

// Quadro dos avisos de acesso, no pé do cartão.
const FONTE_AVISO = 8;
const RECUO_AVISO = 3.5;
const RECUO_MARCADOR = 3;
const ESPACO_ENTRE_AVISOS = 0.8;

type DadosMedicao = { pedido: PedidoComIngressos; ingresso: IngressoPublico; variante: VariantePdfIngresso };
type DadosCartao = DadosMedicao & { arte: string | null; qr: string | null };
type LinhaDetalhe = [rotulo: string, valor: string, fonte: "courier" | "helvetica"];

export type MedidasCartao = ReturnType<typeof medirCartao>;

/** Calcula posições e quebras de linha do cartão, encolhendo o QR só quando o conteúdo não cabe na folha. */
export function medirCartao(pdf: jsPDF, { pedido, ingresso, variante }: DadosMedicao) {
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const alturaPagina = pdf.internal.pageSize.getHeight();
  const x = 14;
  const largura = larguraPagina - 28;
  const topo = TOPO_CARTAO;
  const margem = 6;
  const xConteudo = x + margem;
  const larguraConteudo = largura - margem * 2;

  // Topo escuro, que cresce quando o título, a data ou o local ocupam mais linhas.
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  const linhasTitulo: string[] = pdf.splitTextToSize(pedido.event.title, larguraConteudo);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const linhasInfo: string[] = [
    ...pdf.splitTextToSize(formatarDataHoraExtenso(pedido.session.startsAt, pedido.session.endsAt), larguraConteudo),
    ...pdf.splitTextToSize(pedido.event.locationName ?? "Local a confirmar", larguraConteudo),
  ];
  const classificacao = pedido.event.classificacaoEtaria ?? null;
  const linhasClassificacao: string[] = classificacao
    ? pdf.splitTextToSize(descreverClassificacaoEtaria(classificacao), larguraConteudo - SELO_CLASSIFICACAO - 1.8)
    : [];
  const alturaClassificacao = classificacao
    ? ESPACO_ANTES_CLASSIFICACAO + Math.max(SELO_CLASSIFICACAO, linhasClassificacao.length * alturaLinha(10))
    : 0;
  const alturaSelo = variante === "CORTESIA" ? 9 : 0;
  const alturaTextoTopo = alturaSelo + linhasTitulo.length * alturaLinha(15) + 1 + linhasInfo.length * alturaLinha(10) + alturaClassificacao;
  const alturaTopo = Math.max(42, alturaTextoTopo + margem * 2);

  // Corpo: quadros, QR, detalhes e avisos.
  const yQuadros = topo + alturaTopo + margem;
  const alturaQuadro = 20;
  const yQr = yQuadros + alturaQuadro + 6;
  pdf.setFontSize(9);
  const instrucao: string[] = pdf.splitTextToSize("Na entrada, mostre o QR code ou informe o número.", 80);
  const linhasDetalhe: LinhaDetalhe[] = [
    ["Número do ingresso", formatarNumeroIngresso(ingresso.numero), "courier"],
    ["Participante", ingresso.participantName, "helvetica"],
    ["Valor do ingresso", formatarValorIngresso(ingresso.priceCents, { cortesia: variante === "CORTESIA" }), "helvetica"],
    ["Pedido nº", pedido.orderNumber, "helvetica"],
  ];
  const espacoDetalhe = 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(FONTE_AVISO);
  const avisos: string[][] = AVISOS_INGRESSO.map((aviso) => pdf.splitTextToSize(aviso, larguraConteudo - RECUO_AVISO * 2 - RECUO_MARCADOR) as string[]);
  const linhasAviso = avisos.reduce((total, linhas) => total + linhas.length, 0);
  const alturaAvisos = 3 + linhasAviso * alturaLinha(FONTE_AVISO) + (avisos.length - 1) * ESPACO_ENTRE_AVISOS + 2.2;

  const posicoes = (tamanhoQr: number) => {
    const yInstrucao = yQr + tamanhoQr + 5;
    const yDivisoria = yInstrucao + (instrucao.length - 1) * alturaLinha(9) + 5;
    const yPrimeiroDetalhe = yDivisoria + 7;
    const yAvisos = yPrimeiroDetalhe + (linhasDetalhe.length - 1) * espacoDetalhe + 4.5;
    const alturaCartao = yAvisos + alturaAvisos + margem - topo;
    return { yInstrucao, yDivisoria, yPrimeiroDetalhe, yAvisos, alturaCartao };
  };
  const excesso = topo + posicoes(QR_PADRAO).alturaCartao - (alturaPagina - MARGEM_INFERIOR);
  const tamanhoQr = Math.max(QR_MINIMO, QR_PADRAO - Math.max(0, excesso));

  return {
    x, largura, topo, margem, xConteudo, larguraConteudo, centro: x + largura / 2,
    linhasTitulo, linhasInfo, classificacao, linhasClassificacao, alturaSelo, alturaTextoTopo, alturaTopo,
    yQuadros, alturaQuadro, yQr, tamanhoQr, instrucao, linhasDetalhe, espacoDetalhe, avisos, alturaAvisos,
    ...posicoes(tamanhoQr),
  };
}

/** Desenha um ingresso com o mesmo visual do cartão exibido na tela de ingressos. */
function desenharCartao(pdf: jsPDF, { pedido, ingresso, variante, arte, qr }: DadosCartao): void {
  const m = medirCartao(pdf, { pedido, ingresso, variante });
  const { x, largura, topo, margem, xConteudo, larguraConteudo, centro, alturaTopo, alturaCartao } = m;

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
  let y = topo + alturaTopo - margem - m.alturaTextoTopo;
  if (variante === "CORTESIA") {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    const larguraSelo = pdf.getTextWidth("CORTESIA") + 6;
    pdf.setFillColor(...BRANCO);
    pdf.roundedRect(xConteudo, y, larguraSelo, 5.5, 2.75, 2.75, "F");
    pdf.setTextColor(...ACAO);
    pdf.text("CORTESIA", xConteudo + 3, y + 3.85);
    y += m.alturaSelo;
  }
  pdf.setTextColor(...BRANCO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  for (const linha of m.linhasTitulo) {
    y += alturaLinha(15);
    pdf.text(linha, xConteudo, y - 1.4);
  }
  y += 1;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(232, 236, 233);
  for (const linha of m.linhasInfo) {
    y += alturaLinha(10);
    pdf.text(linha, xConteudo, y - 1);
  }
  if (m.classificacao) {
    // Selo colorido com a sigla da faixa e, ao lado, a descrição por extenso.
    y += ESPACO_ANTES_CLASSIFICACAO;
    const cores = coresClassificacaoEtaria(m.classificacao);
    pdf.setFillColor(...corHex(cores.fundo));
    pdf.setDrawColor(...BRANCO);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(xConteudo, y, SELO_CLASSIFICACAO, SELO_CLASSIFICACAO, 0.9, 0.9, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...corHex(cores.texto));
    pdf.text(siglaClassificacaoEtaria(m.classificacao), xConteudo + SELO_CLASSIFICACAO / 2, y + SELO_CLASSIFICACAO / 2 + 0.95, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(232, 236, 233);
    m.linhasClassificacao.forEach((linha, indice) => {
      pdf.text(linha, xConteudo + SELO_CLASSIFICACAO + 1.8, y + SELO_CLASSIFICACAO / 2 + 1.27 + indice * alturaLinha(10));
    });
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
    pdf.roundedRect(xq, m.yQuadros, larguraQuadro, m.alturaQuadro, 3, 3, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...TINTA_2);
    pdf.text(rotulo, cq, m.yQuadros + 6, { align: "center", charSpace: 0.3 });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(tamanho);
    pdf.setTextColor(...TINTA);
    const linhas: string[] = pdf.splitTextToSize(valor, larguraQuadro - 4).slice(0, 2);
    const base = linhas.length > 1 ? m.yQuadros + 12 : m.yQuadros + (tamanho > 12 ? 15.5 : 14);
    linhas.forEach((linha, i) => pdf.text(linha, cq, base + i * alturaLinha(tamanho), { align: "center" }));
  });

  // QR code centralizado e instrução logo abaixo.
  if (qr) pdf.addImage(qr, "PNG", centro - m.tamanhoQr / 2, m.yQr, m.tamanhoQr, m.tamanhoQr, undefined, "FAST");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...TINTA_2);
  pdf.text(m.instrucao, centro, m.yInstrucao, { align: "center", lineHeightFactor: 1.25 });

  // Divisória e detalhes em duas colunas.
  pdf.setDrawColor(...LINHA);
  pdf.line(xConteudo, m.yDivisoria, xConteudo + larguraConteudo, m.yDivisoria);
  m.linhasDetalhe.forEach(([rotulo, valor, fonte], indice) => {
    const yl = m.yPrimeiroDetalhe + indice * m.espacoDetalhe;
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

  // Avisos de acesso à plateia, num quadro discreto como os de fileira e assento.
  pdf.setFillColor(...SUPERFICIE);
  pdf.roundedRect(xConteudo, m.yAvisos, larguraConteudo, m.alturaAvisos, 3, 3, "F");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(FONTE_AVISO);
  let ya = m.yAvisos + 3;
  m.avisos.forEach((linhas, indice) => {
    if (indice > 0) ya += ESPACO_ENTRE_AVISOS;
    linhas.forEach((linha, i) => {
      ya += alturaLinha(FONTE_AVISO);
      if (i === 0) {
        pdf.setFillColor(...ACAO);
        pdf.circle(xConteudo + RECUO_AVISO + 0.7, ya - 1.85, 0.6, "F");
      }
      pdf.setTextColor(...TINTA);
      pdf.text(linha, xConteudo + RECUO_AVISO + RECUO_MARCADOR, ya - 0.9);
    });
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
