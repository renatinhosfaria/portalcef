/** Conversões entre a tela e as coordenadas do mapa (viewBox com "meet" e zoom do d3). */

export interface TransformacaoZoom {
  x: number;
  y: number;
  k: number;
}

export interface CaixaFoco {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export const ESCALA_MINIMA = 1;
export const ESCALA_MAXIMA = 8;
const MARGEM_FOCO = 0.2;

export function converterPontoTela(entrada: {
  clientX: number;
  clientY: number;
  caixa: { left: number; top: number; width: number; height: number };
  largura: number;
  altura: number;
  zoom: TransformacaoZoom;
}): { x: number; y: number } {
  const { clientX, clientY, caixa, largura, altura, zoom } = entrada;
  // "meet": a escala é a menor das duas e o mapa fica centralizado na caixa.
  const escala = Math.min(caixa.width / largura, caixa.height / altura);
  const deslocamentoX = (caixa.width - largura * escala) / 2;
  const deslocamentoY = (caixa.height - altura * escala) / 2;
  const naViewBoxX = (clientX - caixa.left - deslocamentoX) / escala;
  const naViewBoxY = (clientY - caixa.top - deslocamentoY) / escala;
  return { x: (naViewBoxX - zoom.x) / zoom.k, y: (naViewBoxY - zoom.y) / zoom.k };
}

/** Transformação de zoom que enquadra a caixa, com 20% de margem, no centro do mapa. */
export function transformParaFoco(caixa: CaixaFoco, largura: number, altura: number): TransformacaoZoom {
  const larguraComMargem = Math.max(caixa.largura, 1) * (1 + MARGEM_FOCO);
  const alturaComMargem = Math.max(caixa.altura, 1) * (1 + MARGEM_FOCO);
  const k = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, Math.min(largura / larguraComMargem, altura / alturaComMargem)));
  const centroX = caixa.x + caixa.largura / 2;
  const centroY = caixa.y + caixa.altura / 2;
  return { k, x: largura / 2 - k * centroX, y: altura / 2 - k * centroY };
}
