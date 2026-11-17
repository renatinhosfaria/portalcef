import { describe, expect, it } from "vitest";
import { assinaturaComposicaoPacotes, montarItensPrecoPacotes, validarComposicaoPacotes, type AssentoPacote } from "./pacotes";

const tipos = [
  { id: "combo", name: "Combo", priceCents: 10001, lugaresPorPacote: 3, version: 2 },
  { id: "dez", name: "Dez", priceCents: 38000, lugaresPorPacote: 10 },
  { id: "avulso", name: "Inteira", priceCents: 4500 },
];
function grupo(n = 3, pacoteId = "grupo", tipo = "combo", inicio = 0): AssentoPacote[] {
  return Array.from({ length: n }, (_, i) => ({ seatId: String(i + inicio).padStart(4, "0"), ticketTypeId: tipo, participantIndex: i + inicio, pacoteId }));
}
describe("pacotes de ingressos", () => {
  it("rateia os centavos por assento, separadamente em cada pacote", () => {
    const itens = montarItensPrecoPacotes([...grupo(), ...grupo(3, "outro", "combo", 3)], tipos);
    expect(itens.map(i => i.basePriceCents)).toEqual([3334, 3334, 3333, 3334, 3334, 3333]);
    expect(itens.reduce((s, i) => s + i.basePriceCents, 0)).toBe(20002);
    expect(itens[0]?.pacote).toEqual({ id: "grupo", lugaresPorPacote: 3, precoPacoteCentavos: 10001, versaoTipo: 2, nomeTipo: "Combo" });
    expect(montarItensPrecoPacotes(grupo(10, "dez", "dez"), tipos).map(i => i.basePriceCents)).toEqual(Array(10).fill(3800));
  });
  it("mantém preço de cada lugar quando a entrada é reordenada", () => {
    const itens = montarItensPrecoPacotes(grupo().reverse(), tipos);
    expect(itens.map(i => [i.seatId, i.basePriceCents, i.participantIndex])).toEqual([["0002", 3333, 2], ["0001", 3334, 1], ["0000", 3334, 0]]);
  });
  it("aceita avulsos legados sem grupo e bases de valor zero", () => {
    expect(montarItensPrecoPacotes([{seatId:"a",ticketTypeId:"avulso",participantIndex:0}],tipos)[0]?.basePriceCents).toBe(4500);
    expect(montarItensPrecoPacotes(grupo(),[{...tipos[0]!,priceCents:1}]).map(i=>i.basePriceCents)).toEqual([1,0,0]);
  });
  it.each([
    ["incompleto", grupo(2)],
    ["sem grupo", grupo().map(({pacoteId: _id, ...s})=>s)],
    ["tipo misto", [...grupo(2), {...grupo()[2]!,ticketTypeId:"avulso"}]],
    ["assento repetido", [...grupo(), grupo()[0]!]],
    ["tipo inexistente", grupo(3,"g","ausente")],
    ["avulso com grupo", grupo(1,"g","avulso")],
    ["dois grupos incompletos", [...grupo(5,"a","dez"),...grupo(5,"b","dez",5)]],
  ])("recusa %s", (_, assentos) => {
    expect(()=>validarComposicaoPacotes(assentos as AssentoPacote[], tipos)).toThrow();
  });
  it("canoniza grupos sem depender de UUID transitório nem configuração atual", () => {
    const original = [...grupo(), ...grupo(3,"outro","combo",3)];
    const renomeado = original.map(s=>({...s,pacoteId:s.pacoteId === "grupo" ? "novo-a" : "novo-b"})).reverse();
    expect(assinaturaComposicaoPacotes("sessao",original)).toBe(assinaturaComposicaoPacotes("sessao",renomeado));
    const trocado = original.map((s,i)=>({...s,pacoteId:i===0?"outro":i===3?"grupo":s.pacoteId}));
    expect(assinaturaComposicaoPacotes("sessao",original)).not.toBe(assinaturaComposicaoPacotes("sessao",trocado));
    expect(assinaturaComposicaoPacotes("outra",original)).not.toBe(assinaturaComposicaoPacotes("sessao",original));
  });
});
