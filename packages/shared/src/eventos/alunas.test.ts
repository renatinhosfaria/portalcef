import { describe, expect, it } from "vitest";
import { agruparPorAluna, chaveAluna } from "./alunas";

const ingresso = (studentName: string | null, numero = "X") => ({ studentName, numero });

describe("chaveAluna", () => {
  it("ignora maiúsculas, acentos e espaços sobrando", () => {
    expect(chaveAluna("  María   CLARA ")).toBe("maria clara");
    expect(chaveAluna("Beatriz O. Santos")).toBe("beatriz o. santos");
  });

  it("devolve vazio para nome ausente ou em branco", () => {
    expect(chaveAluna("   ")).toBe("");
    expect(chaveAluna(null)).toBe("");
    expect(chaveAluna(undefined)).toBe("");
  });
});

describe("agruparPorAluna", () => {
  it("conta juntas as grafias que só diferem em caixa, acento e espaço", () => {
    const r = agruparPorAluna([ingresso("Maria Clara"), ingresso("maria clara "), ingresso("María Clara"), ingresso("Beatriz")], []);

    expect(r.alunas.map((a) => [a.nome, a.total])).toEqual([["Maria Clara", 3], ["Beatriz", 1]]);
  });

  it("mantém separadas as variações que a escola ainda não juntou", () => {
    const r = agruparPorAluna([ingresso("Beatriz"), ingresso("Beatriz Oliveira"), ingresso("Beatriz Oliveira Santos"), ingresso("Beatriz O. Santos")], []);

    expect(r.alunas).toHaveLength(4);
    expect(r.alunas.every((a) => a.total === 1)).toBe(true);
  });

  it("soma as grafias juntadas pela escola no nome de destino", () => {
    const r = agruparPorAluna(
      [ingresso("Beatriz Oliveira"), ingresso("Beatriz Oliveira Santos"), ingresso("Beatriz Oliveira Santos"), ingresso("Beatriz O. Santos"), ingresso("Beatriz")],
      [
        { sourceKey: "beatriz oliveira", targetKey: "beatriz oliveira santos" },
        { sourceKey: "beatriz o. santos", targetKey: "beatriz oliveira santos" },
      ],
    );

    expect(r.alunas.map((a) => [a.chave, a.nome, a.total])).toEqual([
      ["beatriz oliveira santos", "Beatriz Oliveira Santos", 4],
      ["beatriz", "Beatriz", 1],
    ]);
    expect(r.alunas[0]!.grafias).toEqual([
      { chave: "beatriz oliveira santos", nome: "Beatriz Oliveira Santos", total: 2, juntada: false },
      { chave: "beatriz o. santos", nome: "Beatriz O. Santos", total: 1, juntada: true },
      { chave: "beatriz oliveira", nome: "Beatriz Oliveira", total: 1, juntada: true },
    ]);
  });

  it("segue junções encadeadas e não trava em ciclo", () => {
    const encadeada = agruparPorAluna([ingresso("A"), ingresso("B"), ingresso("C")], [{ sourceKey: "a", targetKey: "b" }, { sourceKey: "b", targetKey: "c" }]);
    expect(encadeada.alunas.map((a) => [a.chave, a.total])).toEqual([["c", 3]]);

    const ciclo = agruparPorAluna([ingresso("A"), ingresso("B")], [{ sourceKey: "a", targetKey: "b" }, { sourceKey: "b", targetKey: "a" }]);
    expect(ciclo.alunas.reduce((soma, a) => soma + a.total, 0)).toBe(2);
  });

  it("usa a grafia mais frequente como nome e, no empate, a primeira digitada", () => {
    const r = agruparPorAluna([ingresso("ana lima"), ingresso("Ana Lima"), ingresso("Ana Lima")], []);
    expect(r.alunas[0]!.nome).toBe("Ana Lima");
    expect(agruparPorAluna([ingresso("ana lima"), ingresso("Ana Lima")], []).alunas[0]!.nome).toBe("ana lima");
  });

  it("usa uma grafia do grupo quando o destino não tem mais ingressos", () => {
    const r = agruparPorAluna([ingresso("Bia Santos")], [{ sourceKey: "bia santos", targetKey: "beatriz santos" }]);
    expect(r.alunas).toEqual([expect.objectContaining({ chave: "beatriz santos", nome: "Bia Santos", total: 1 })]);
  });

  it("separa os ingressos sem aluna e devolve os itens de cada grupo", () => {
    const r = agruparPorAluna([ingresso("Ana", "1"), ingresso(null, "2"), ingresso("  ", "3"), ingresso("ana", "4")], []);

    expect(r.semAluna).toBe(2);
    expect(r.alunas[0]!.itens.map((i) => i.numero)).toEqual(["1", "4"]);
  });

  it("ordena por total decrescente e depois por nome", () => {
    const r = agruparPorAluna([ingresso("Zélia"), ingresso("Ana"), ingresso("Carla"), ingresso("Carla")], []);
    expect(r.alunas.map((a) => a.nome)).toEqual(["Carla", "Ana", "Zélia"]);
  });
});
