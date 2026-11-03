import { describe, expect, it } from "vitest";
import {
  ErroProposta,
  acessoExternoEfetivo,
  aplicarOperacoes,
  categoriaEfetiva,
  dimensoesLugar,
  operacoesPropostaSchema,
  pendenciasPublicacao,
  resumoProposta,
  type LugarProposto,
  type PropostaMapa,
} from "./mapa-proposta";

function criarLugar(parcial: Partial<LugarProposto> & Pick<LugarProposto, "id" | "numero" | "cor">): LugarProposto {
  return {
    fileira: "A",
    x: 0,
    y: 0,
    largura: 100,
    altura: 90,
    rotacao: 0,
    blocoId: null,
    categoriaManual: null,
    acessoExternoManual: null,
    vender: true,
    origem: "GERADOR",
    ...parcial,
  };
}

const base: PropostaMapa = {
  versao: 1,
  revisao: 3,
  pagina: { numero: 1, largura: 8420, altura: 5950 },
  lugares: [
    criarLugar({ id: "l1", numero: "1", cor: "#000000", x: 100, largura: 100, altura: 90 }),
    criarLugar({ id: "l2", numero: "2", cor: "#000000", x: 300, largura: 110, altura: 100 }),
    criarLugar({ id: "l3", numero: "3", cor: "#006edd", x: 500, largura: 120, altura: 110 }),
  ],
  rotulos: [],
  elementos: [],
  legenda: [
    { cor: "#000000", texto: null, quantidade: 2, categoria: "COMUM", acessoExterno: false, confirmada: false },
    { cor: "#006edd", texto: null, quantidade: 1, categoria: "CADEIRANTE", acessoExterno: false, confirmada: false },
  ],
  pontos: [{ id: "p1", tipo: "FORA_DA_LINHA", mensagem: "A-3 fora da linha", lugarIds: ["l3"], conferido: false }],
};

describe("mapa-proposta", () => {
  it("edita um lugar sem mutar a proposta original e incrementa a revisão", () => {
    const nova = aplicarOperacoes(base, [{ tipo: "EDITAR_LUGAR", lugarId: "l2", numero: "20", vender: false }]);
    expect(nova.revisao).toBe(base.revisao + 1);
    expect(nova.lugares[1]).toMatchObject({ numero: "20", vender: false });
    expect(base.lugares[1].numero).toBe("2");
    expect(base.revisao).toBe(3);
  });

  it("categoria manual vence a legenda e null volta a seguir a legenda", () => {
    const manual = aplicarOperacoes(base, [{ tipo: "EDITAR_LUGAR", lugarId: "l3", categoria: "OBESO" }]);
    expect(categoriaEfetiva(manual, manual.lugares[2])).toBe("OBESO");
    const volta = aplicarOperacoes(manual, [{ tipo: "EDITAR_LUGAR", lugarId: "l3", categoria: null }]);
    expect(categoriaEfetiva(volta, volta.lugares[2])).toBe("CADEIRANTE");
  });

  it("acesso externo manual vence a legenda e null volta a seguir a legenda", () => {
    const manual = aplicarOperacoes(base, [{ tipo: "EDITAR_LUGAR", lugarId: "l1", acessoExterno: true }]);
    expect(acessoExternoEfetivo(manual, manual.lugares[0])).toBe(true);
    expect(acessoExternoEfetivo(manual, manual.lugares[1])).toBe(false);
    const volta = aplicarOperacoes(manual, [{ tipo: "EDITAR_LUGAR", lugarId: "l1", acessoExterno: null }]);
    expect(acessoExternoEfetivo(volta, volta.lugares[0])).toBe(false);
  });

  it("confirmar a legenda muda a categoria efetiva de todos os lugares daquela cor", () => {
    const nova = aplicarOperacoes(base, [
      { tipo: "CONFIRMAR_LEGENDA", cor: "#000000", categoria: "OPCIONAL_CADEIRANTE", acessoExterno: true },
    ]);
    expect(categoriaEfetiva(nova, nova.lugares[0])).toBe("OPCIONAL_CADEIRANTE");
    expect(categoriaEfetiva(nova, nova.lugares[1])).toBe("OPCIONAL_CADEIRANTE");
    expect(categoriaEfetiva(nova, nova.lugares[2])).toBe("CADEIRANTE");
    expect(acessoExternoEfetivo(nova, nova.lugares[0])).toBe(true);
    expect(acessoExternoEfetivo(nova, nova.lugares[1])).toBe(true);
    expect(nova.legenda[0].confirmada).toBe(true);
    expect(nova.legenda[1].confirmada).toBe(false);
  });

  it("excluir remove o lugar e o ponto que ficou vazio", () => {
    const nova = aplicarOperacoes(base, [{ tipo: "EXCLUIR_LUGAR", lugarId: "l3" }]);
    expect(nova.lugares.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(nova.pontos).toEqual([]);
  });

  it("excluir mantém o ponto que ainda tem outros lugares", () => {
    const comDois = { ...base, pontos: [{ ...base.pontos[0], lugarIds: ["l2", "l3"] }] };
    const nova = aplicarOperacoes(comDois, [{ tipo: "EXCLUIR_LUGAR", lugarId: "l3" }]);
    expect(nova.pontos[0].lugarIds).toEqual(["l2"]);
  });

  it("adicionar cria lugar MANUAL com tamanho mediano e cor dominante", () => {
    const nova = aplicarOperacoes(base, [
      { tipo: "ADICIONAR_LUGAR", lugar: { id: "l4", fileira: "B", numero: "1", x: 700, y: 50 } },
    ]);
    expect(nova.lugares[3]).toEqual({
      id: "l4",
      fileira: "B",
      numero: "1",
      x: 700,
      y: 50,
      largura: 110,
      altura: 100,
      rotacao: 0,
      blocoId: null,
      cor: "#000000",
      categoriaManual: null,
      acessoExternoManual: null,
      vender: true,
      origem: "MANUAL",
    });
  });

  it("rejeita lugar inexistente, ponto, cor inexistente e id repetido", () => {
    expect(() => aplicarOperacoes(base, [{ tipo: "EXCLUIR_LUGAR", lugarId: "x" }])).toThrow(ErroProposta);
    expect(() => aplicarOperacoes(base, [{ tipo: "EDITAR_LUGAR", lugarId: "x", numero: "1" }])).toThrow(ErroProposta);
    expect(() => aplicarOperacoes(base, [{ tipo: "CONFERIR_PONTO", pontoId: "x" }])).toThrow(ErroProposta);
    expect(() =>
      aplicarOperacoes(base, [{ tipo: "CONFIRMAR_LEGENDA", cor: "#ffffff", categoria: "COMUM", acessoExterno: false }]),
    ).toThrow(ErroProposta);
    expect(() =>
      aplicarOperacoes(base, [{ tipo: "ADICIONAR_LUGAR", lugar: { id: "l1", fileira: "A", numero: "9", x: 0, y: 0 } }]),
    ).toThrow(ErroProposta);
    try {
      aplicarOperacoes(base, [{ tipo: "EXCLUIR_LUGAR", lugarId: "x" }]);
    } catch (erro) {
      expect((erro as ErroProposta).code).toBe("PROPOSTA_OPERACAO_INVALIDA");
    }
  });

  it("lista as pendências que bloqueiam a publicação", () => {
    const comProblemas = aplicarOperacoes(base, [
      { tipo: "EDITAR_LUGAR", lugarId: "l2", numero: "1" },
      { tipo: "EDITAR_LUGAR", lugarId: "l3", fileira: "" },
    ]);
    const pendencias = pendenciasPublicacao(comProblemas);
    expect(pendencias.map((p) => p.tipo).sort()).toEqual([
      "COR_NAO_CONFIRMADA",
      "COR_NAO_CONFIRMADA",
      "LUGAR_REPETIDO",
      "LUGAR_SEM_FILEIRA",
      "PONTO_NAO_CONFERIDO",
    ]);
    expect(pendencias.find((p) => p.tipo === "LUGAR_REPETIDO")).toMatchObject({
      mensagem: "A-1 aparece duas vezes",
      lugarIds: ["l1", "l2"],
    });
    expect(pendencias.map((p) => p.mensagem)).toContain("Confirme o significado da cor #006edd");
    expect(pendenciasPublicacao({ ...base, lugares: [] }).map((p) => p.tipo)).toContain("MAPA_VAZIO");
  });

  it("não há pendências depois de conferir pontos e confirmar todas as cores", () => {
    const pronta = aplicarOperacoes(base, [
      { tipo: "CONFERIR_PONTO", pontoId: "p1" },
      { tipo: "CONFIRMAR_LEGENDA", cor: "#000000", categoria: "COMUM", acessoExterno: false },
      { tipo: "CONFIRMAR_LEGENDA", cor: "#006edd", categoria: "CADEIRANTE", acessoExterno: false },
    ]);
    expect(pendenciasPublicacao(pronta)).toEqual([]);
  });

  it("resume fileiras, blocos, lugares e categorias", () => {
    const resumo = resumoProposta(base);
    expect(resumo).toEqual({
      fileiras: 1,
      blocos: 0,
      lugares: 3,
      porCategoria: { COMUM: 2, CADEIRANTE: 1, OPCIONAL_CADEIRANTE: 0, OBESO: 0, SEM_CATEGORIA: 0 },
      acessoExterno: 0,
      naoVender: 0,
    });
  });

  it("resume blocos, acesso externo, não vender e lugares sem categoria", () => {
    const nova = aplicarOperacoes(base, [
      { tipo: "EDITAR_LUGAR", lugarId: "l1", vender: false, acessoExterno: true, fileira: "B" },
    ]);
    nova.lugares[0].blocoId = "b1";
    nova.lugares[1].blocoId = "b1";
    nova.lugares[2].blocoId = "b2";
    nova.legenda[1].categoria = null;
    expect(resumoProposta(nova)).toMatchObject({
      fileiras: 2,
      blocos: 2,
      acessoExterno: 1,
      naoVender: 1,
      porCategoria: { COMUM: 2, SEM_CATEGORIA: 1 },
    });
  });

  it("alarga o lugar de obeso em 1,6 vez", () => {
    const lugar = criarLugar({ id: "x", numero: "1", cor: "#000000" });
    expect(dimensoesLugar({ ...lugar, largura: 106, altura: 95 }, "OBESO")).toEqual({ largura: 170, altura: 95 });
    expect(dimensoesLugar({ ...lugar, largura: 106, altura: 95 }, "COMUM")).toEqual({ largura: 106, altura: 95 });
    expect(dimensoesLugar({ ...lugar, largura: 106, altura: 95 }, null)).toEqual({ largura: 106, altura: 95 });
  });

  it("valida as operações com zod e recusa categoria fora da lista", () => {
    expect(
      operacoesPropostaSchema.safeParse([
        { tipo: "CONFIRMAR_LEGENDA", cor: "#000000", categoria: "VIP", acessoExterno: false },
      ]).success,
    ).toBe(false);
    expect(
      operacoesPropostaSchema.safeParse([
        { tipo: "CONFIRMAR_LEGENDA", cor: "#000000", categoria: "COMUM", acessoExterno: false },
      ]).success,
    ).toBe(true);
    expect(operacoesPropostaSchema.safeParse([]).success).toBe(false);
    const muitas = Array.from({ length: 501 }, () => ({ tipo: "CONFERIR_PONTO", pontoId: "p1" }));
    expect(operacoesPropostaSchema.safeParse(muitas).success).toBe(false);
  });
});
