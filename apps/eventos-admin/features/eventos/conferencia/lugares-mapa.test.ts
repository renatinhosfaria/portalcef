import { describe, expect, it } from "vitest";
import type { PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import { paraLugaresMapa } from "./lugares-mapa";

const proposta: PropostaMapa = {
  versao: 1,
  revisao: 1,
  pagina: { numero: 1, largura: 8420, altura: 5950 },
  lugares: [
    { id: "l1", fileira: "A", numero: "1", x: 1000, y: 1000, largura: 200, altura: 200, rotacao: 0, blocoId: null, cor: "#c1", categoriaManual: null, acessoExternoManual: null, vender: true, origem: "GERADOR" },
    { id: "l2", fileira: "A", numero: "2", x: 1300, y: 1000, largura: 200, altura: 200, rotacao: 0, blocoId: null, cor: "#c1", categoriaManual: "CADEIRANTE", acessoExternoManual: null, vender: false, origem: "GERADOR" },
  ],
  rotulos: [],
  elementos: [],
  legenda: [{ cor: "#c1", texto: "Comum", quantidade: 2, categoria: "COMUM", acessoExterno: false, confirmada: true }],
  pontos: [],
};

describe("paraLugaresMapa", () => {
  it("converte lugares da proposta com categoria efetiva e estado de venda", () => {
    const lugares = paraLugaresMapa(proposta);
    expect(lugares).toHaveLength(2);
    expect(lugares[0]).toMatchObject({ id: "l1", categoria: "COMUM", estado: "livre", acessoExterno: false });
    expect(lugares[1]).toMatchObject({ id: "l2", categoria: "CADEIRANTE", estado: "bloqueado" });
  });
});
