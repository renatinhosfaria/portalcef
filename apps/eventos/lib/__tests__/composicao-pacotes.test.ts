import { describe, expect, it } from "vitest";
import type { PublicEventTicketType } from "@essencia/shared/types";
import { adicionarPacote, desfazerPacote, removerAssentos, selecaoCompleta } from "../composicao-pacotes";
import { calcularPrecoSelecao } from "../selecao-lugares";

const inteira: PublicEventTicketType={id:"inteira",name:"Inteira",description:null,priceCents:4500,maxPerOrder:null,eligibility:null};
const combo: PublicEventTicketType={...inteira,id:"combo",name:"Combo 10",lugaresPorPacote:10,priceCents:38000};
const tres: PublicEventTicketType={...combo,id:"tres",name:"Pacote 3",lugaresPorPacote:3,priceCents:10001};
const tipos=[inteira,combo,tres];
const lugares=(n:number)=>Array.from({length:n},(_,i)=>({seatId:`s-${i}`,ticketTypeId:"inteira"}));
describe("composição de pacotes no mapa",()=>{
  it.each([[10,38000],[11,42500],[20,83000],[30,128000]])("converte dez dos %s avulsos em um pacote",(n,total)=>{
    const selecao=adicionarPacote(lugares(n),tipos,"combo","p1");
    expect(selecao.filter(s=>s.pacoteId==="p1")).toHaveLength(10);
    expect(calcularPrecoSelecao(selecao,tipos).totalCents).toBe(total);
    expect(selecaoCompleta(selecao,tipos)).toBe(true);
  });
  it("não cria pacote parcial e prioriza lugares sem classificação",()=>{
    const nove=lugares(9);
    expect(adicionarPacote(nove,tipos,"combo","p1")).toBe(nove);
    const onze=lugares(11).map((s,i)=>i===10?{...s,ticketTypeId:""}:s);
    const selecao=adicionarPacote(onze,tipos,"combo","p1");
    expect(selecao[10]?.pacoteId).toBe("p1");
    expect(selecao[9]?.pacoteId).toBeUndefined();
  });
  it("permite três combos e múltiplos tamanhos sem sobreposição",()=>{
    let selecao=lugares(30);
    for(let i=0;i<3;i++) selecao=adicionarPacote(selecao,tipos,"combo",`p${i}`);
    expect(calcularPrecoSelecao(selecao,tipos).totalCents).toBe(114000);
    expect(new Set(selecao.map(s=>s.seatId)).size).toBe(30);
    const misto=adicionarPacote(adicionarPacote(lugares(13),tipos,"combo","dez"),tipos,"tres","tres");
    expect(calcularPrecoSelecao(misto,tipos).totalCents).toBe(48001);
    expect(selecaoCompleta(misto,tipos)).toBe(true);
  });
  it("desfaz apenas o pacote afetado e deixa sobreviventes sem tipo",()=>{
    const dois=adicionarPacote(adicionarPacote(lugares(20),tipos,"combo","p1"),tipos,"combo","p2");
    const removida=removerAssentos(dois,["s-0"]);
    expect(removida).toHaveLength(19);
    expect(removida.filter(s=>s.pacoteId==="p2")).toHaveLength(10);
    expect(removida.filter(s=>s.ticketTypeId==="")).toHaveLength(9);
    expect(selecaoCompleta(removida,tipos)).toBe(false);
    expect(calcularPrecoSelecao(removida,tipos).totalCents).toBe(38000);
    expect(desfazerPacote(dois,"p1").filter(s=>s.ticketTypeId==="")).toHaveLength(10);
  });
  it("respeita limite opcional de lugares por tipo e rejeita duplicidade",()=>{
    const limitados=[inteira,{...combo,maxPerOrder:10}];
    const selecao=adicionarPacote(lugares(20),limitados,"combo","p1");
    expect(adicionarPacote(selecao,limitados,"combo","p2")).toBe(selecao);
    expect(selecaoCompleta([lugares(1)[0]!,lugares(1)[0]!],tipos)).toBe(false);
    expect(selecaoCompleta(lugares(30),[ {...inteira,maxPerOrder:20} ])).toBe(false);
  });
  it("não cobra pacote sem composição nem considera seleção vazia completa",()=>{
    expect(calcularPrecoSelecao([{seatId:"s",ticketTypeId:"combo"}],tipos).subtotalCents).toBe(0);
    expect(selecaoCompleta([{seatId:"s",ticketTypeId:"combo"}],tipos)).toBe(false);
    expect(selecaoCompleta([],tipos)).toBe(false);
  });
});
