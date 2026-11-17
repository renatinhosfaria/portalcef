// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { lerRascunhoSelecao, salvarRascunhoSelecao, type RascunhoSelecao } from "../rascunho-selecao";
import { montarHrefRetornoMapa } from "../checkout-utils";

afterEach(()=>{vi.restoreAllMocks();sessionStorage.clear();});
const grande: RascunhoSelecao={versao:1,sessionId:"sessao",assentos:Array.from({length:300},(_,i)=>({seatId:`s-${i}`,ticketTypeId:"combo",pacoteId:`p-${Math.floor(i/10)}`}))};
it("recupera trezentos lugares e grupos por uma referência curta",()=>{
  const id=salvarRascunhoSelecao(grande);
  const href=montarHrefRetornoMapa({slug:"evento",sessionId:"sessao",rascunhoId:id});
  expect(href.length).toBeLessThan(250);
  expect(href).toContain(`selecao=${id}`);
  expect(lerRascunhoSelecao(id,"sessao")).toEqual(grande);
  expect(salvarRascunhoSelecao({...grande,assentos:[]},id)).toBe(id);
  expect(lerRascunhoSelecao(id,"sessao")?.assentos).toEqual([]);
});
it("recusa outra sessão, JSON inválido, versão desconhecida e lugares repetidos",()=>{
  const id=salvarRascunhoSelecao(grande);
  expect(lerRascunhoSelecao(id,"outra")).toBeNull();
  for(const valor of ["{",JSON.stringify({...grande,versao:2}),JSON.stringify({...grande,assentos:[grande.assentos[0],grande.assentos[0]]})]) {
    sessionStorage.setItem(`eventos:selecao:${id}`,valor);
    expect(lerRascunhoSelecao(id,"sessao")).toBeNull();
  }
});
it("falha de gravação é recuperável e leitura bloqueada não quebra a tela",()=>{
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("sem espaço");});
  expect(()=>salvarRascunhoSelecao(grande)).toThrow("Não foi possível guardar a seleção");
  vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new Error("bloqueado");});
  expect(lerRascunhoSelecao("00000000-0000-4000-8000-000000000001","sessao")).toBeNull();
});
it("não grava campos de comprador ou participantes junto à seleção",()=>{
  expect(()=>salvarRascunhoSelecao({...grande,buyer:{name:"dado de teste"}} as RascunhoSelecao)).toThrow();
  expect(sessionStorage.length).toBe(0);
});
