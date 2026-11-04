import {
  CATEGORIA_ACESSIVEL,
  acessoExternoEfetivo,
  categoriaEfetiva,
  dimensoesLugar,
  type LayoutMapa,
  type PropostaMapa,
} from "@essencia/shared/eventos/mapa-proposta";
import type { ConfirmMapInput } from "../mapas.service";

/**
 * Converte a proposta conferida nos dados gravados no mapa publicado.
 * Na proposta, x e y são o centro do lugar; no mapa, são o canto superior esquerdo da caixa sem rotação.
 */
export function propostaParaConfirmacao(proposta: PropostaMapa): { seats: ConfirmMapInput["seats"]; layout: LayoutMapa } {
  const seats = proposta.lugares.map((lugar) => {
    const categoria = categoriaEfetiva(proposta, lugar);
    const { largura, altura } = dimensoesLugar(lugar, categoria);
    return {
      rowLabel: lugar.fileira,
      seatNumber: lugar.numero,
      x: Math.round(lugar.x - largura / 2),
      y: Math.round(lugar.y - altura / 2),
      width: largura,
      height: altura,
      category: categoria,
      accessible: categoria ? CATEGORIA_ACESSIVEL[categoria] : false,
      sellable: lugar.vender,
      metadata: {
        rotacao: lugar.rotacao,
        blocoId: lugar.blocoId,
        acessoExterno: acessoExternoEfetivo(proposta, lugar),
        origem: lugar.origem,
      },
    };
  });
  const layout: LayoutMapa = {
    versao: 1,
    largura: proposta.pagina.largura,
    altura: proposta.pagina.altura,
    rotulos: proposta.rotulos,
    elementos: proposta.elementos,
  };
  return { seats, layout };
}
