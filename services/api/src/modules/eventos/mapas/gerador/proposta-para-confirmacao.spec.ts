import type { LugarProposto, PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import { propostaParaConfirmacao } from "./proposta-para-confirmacao";

function lugar(sobrescrever: Partial<LugarProposto> = {}): LugarProposto {
  return {
    id: "l1", fileira: "A", numero: "1", x: 1000, y: 2000, largura: 100, altura: 80, rotacao: 0, blocoId: "b1",
    cor: "#fff", categoriaManual: null, acessoExternoManual: null, vender: true, origem: "GERADOR", ...sobrescrever,
  };
}

function proposta(lugares: LugarProposto[]): PropostaMapa {
  return {
    versao: 1, revisao: 3, pagina: { numero: 1, largura: 8420, altura: 5950 }, lugares,
    rotulos: [{ fileira: "A", x: 500, y: 2000 }],
    elementos: [{ tipo: "PALCO", texto: "Palco", x: 4000, y: 300 }],
    legenda: [{ cor: "#fff", texto: "Comum", quantidade: 1, categoria: "COMUM", acessoExterno: false, confirmada: true }],
    pontos: [],
  };
}

describe("propostaParaConfirmacao", () => {
  it("converte centro em canto, alarga obeso e grava categoria, acessibilidade, venda e metadados", () => {
    const { seats } = propostaParaConfirmacao(proposta([
      lugar(),
      lugar({ id: "l2", numero: "2", x: 1255, y: 2001, categoriaManual: "OBESO", acessoExternoManual: true, rotacao: 90, blocoId: null, origem: "MANUAL", vender: false }),
      lugar({ id: "l3", numero: "3", categoriaManual: "CADEIRANTE" }),
    ]));
    expect(seats[0]).toEqual({
      rowLabel: "A", seatNumber: "1", x: 950, y: 1960, width: 100, height: 80,
      category: "COMUM", accessible: false, sellable: true,
      metadata: { rotacao: 0, blocoId: "b1", acessoExterno: false, origem: "GERADOR" },
    });
    // largura 100 * 1,6 = 160; x = round(1255 - 80); y = round(2001 - 40)
    expect(seats[1]).toEqual({
      rowLabel: "A", seatNumber: "2", x: 1175, y: 1961, width: 160, height: 80,
      category: "OBESO", accessible: true, sellable: false,
      metadata: { rotacao: 90, blocoId: null, acessoExterno: true, origem: "MANUAL" },
    });
    expect(seats[2]).toMatchObject({ category: "CADEIRANTE", accessible: true });
  });

  it("monta o layout com prancheta, rótulos e elementos", () => {
    const base = proposta([lugar()]);
    const { layout } = propostaParaConfirmacao(base);
    expect(layout).toEqual({ versao: 1, largura: 8420, altura: 5950, rotulos: base.rotulos, elementos: base.elementos });
  });
});
