// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicEventDetail, PublicEventSession, PublicMap } from "@essencia/shared/types";
import * as eventosApi from "../../lib/eventos-api";
import { EscolhaLugares } from "../escolha/escolha-lugares";

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

vi.mock("../../lib/eventos-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/eventos-api")>("../../lib/eventos-api");
  return { ...actual, reservarAssentos: vi.fn(), obterMapaSessao: vi.fn() };
});

const evento: PublicEventDetail = { id: "evento", slug: "festival", title: "Festival", summary: "Resumo", description: null, imageUrl: null, category: "Música", startsAt: new Date("2026-12-07T19:00:00Z"), locationName: "Auditório", fromPriceCents: 4500, availability: "available", contactEmail: null, contactPhone: null, cancellationPolicy: null };
const sessao: PublicEventSession = { id: "sessao", startsAt: new Date("2026-12-07T19:00:00Z"), endsAt: new Date("2026-12-07T21:00:00Z"), status: "PUBLICADA", capacity: 21, location: null, mapId: "mapa", salesStartsAt: null, salesEndsAt: null, availability: "available", ticketTypes: [{ id: "inteira", name: "Inteira", description: null, priceCents: 4500, maxPerOrder: null, eligibility: null }, { id: "meia", name: "Meia-entrada", description: null, priceCents: 2250, maxPerOrder: null, eligibility: "Estudantes" }], offers: [] };
const mapa: PublicMap = { sessionId: "sessao", mapId: "mapa", seats: Array.from({ length: 21 }, (_, index) => ({ id: `s-${index + 1}`, sessionId: "sessao", rowLabel: "G", seatNumber: String(index + 19), x: index * 10, y: 0, width: 8, height: 8, category: "COMUM", accessible: false, state: "available" as const })) };
const ofertaVolume = { id: "oferta", version: 1, name: "Grupo", minQuantity: 10, maxQuantity: null, discountPercent: 15 } as const;

afterEach(cleanup);

describe("EscolhaLugares", () => {
  it("seleciona lugares, exige tipo quando há dois e permite o 21º", () => {
    render(<EscolhaLugares evento={evento} sessao={sessao} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    expect(screen.getByText("Escolha Inteira ou Meia-entrada em cada lugar")).toBeTruthy();
    const resumo = screen.getByRole("region", { name: /Resumo dos lugares/ });
    fireEvent.click(within(resumo).getByRole("radio", { name: /Inteira/ }));
    for (let index = 20; index <= 39; index += 1) {
      const button = screen.queryByRole("button", { name: new RegExp(`assento ${index}`) });
      if (button) fireEvent.click(button);
    }
    expect(screen.getAllByRole("radiogroup")).toHaveLength(21);
  }, 15000);

  it("alterna para lista e vibra ao marcar", () => {
    Object.defineProperty(window.navigator, "vibrate", { configurable: true, value: vi.fn() });
    render(<EscolhaLugares evento={evento} sessao={sessao} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver lugares em lista/ }));
    expect(screen.getByRole("region", { name: /Lugares disponíveis/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Selecionar G19/ }));
    expect(window.navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it("reserva sem comprador e navega para o checkout", async () => {
    vi.mocked(eventosApi.reservarAssentos).mockResolvedValue({ reservationId: "reserva", orderNumber: "PED-123", expiresAt: new Date(), subtotalCents: 4500, offerDiscountCents: 0, couponDiscountCents: 0, discountCents: 0, totalCents: 4500, appliedOffer: null, appliedCoupon: null, items: [] });
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Continuar" })[0]!);
    await waitFor(() => expect(eventosApi.reservarAssentos).toHaveBeenCalledWith({ sessionId: "sessao", seats: [{ seatId: "s-1", ticketTypeId: "inteira", participantIndex: 0 }] }));
    expect(routerPush).toHaveBeenCalledWith("/checkout?pedido=PED-123&slug=festival&sessionId=sessao");
  });

  it("mostra erro genérico com ação para tentar novamente", async () => {
    vi.mocked(eventosApi.reservarAssentos).mockRejectedValue(new Error("falha inesperada"));
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Continuar" })[0]!);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível guardar seus lugares");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar aos lugares" })).toBeTruthy();
  });

  it("usa desconto da oferta na barra mobile", () => {
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!], offers: [ofertaVolume] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={{ ...mapa, seats: mapa.seats.slice(0, 10) }} />);
    for (let index = 19; index <= 28; index += 1) fireEvent.click(screen.getByRole("button", { name: new RegExp(`Fileira G, assento ${index}`) }));
    expect(screen.getAllByText("R$ 382,50").length).toBeGreaterThan(0);
  });

  it("remove o lugar perdido no conflito 409 e anuncia o rótulo", async () => {
    vi.mocked(eventosApi.reservarAssentos).mockRejectedValue(new eventosApi.EventosApiError("indisponível", 409, "SEAT_UNAVAILABLE"));
    vi.mocked(eventosApi.obterMapaSessao).mockResolvedValue({ ...mapa, seats: mapa.seats.map((seat) => seat.id === "s-1" ? { ...seat, state: "sold" as const } : seat) });
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Continuar" })[0]!);
    expect(await screen.findByText("O lugar G19 acabou de ser escolhido por outra pessoa")).toBeTruthy();
    expect(screen.getByText("0 lugares")).toBeTruthy();
  });

  it("não vibra quando movimento reduzido está ativo", () => {
    const vibrate = vi.fn();
    Object.defineProperty(window.navigator, "vibrate", { configurable: true, value: vibrate });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("lista indica acessibilidade e não permite ocupado", () => {
    const mapaAcessivel = { ...mapa, seats: mapa.seats.map((seat, index) => index === 0 ? { ...seat, accessible: true } : index === 1 ? { ...seat, state: "sold" as const } : seat) };
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={mapaAcessivel} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver lugares em lista/ }));
    expect(screen.getByRole("button", { name: /Selecionar G19.*acessível/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Selecionar G20/ })).toBeNull();
  });

  it("no celular, mostra a escolha Inteira/Meia na própria página, sem ficar escondida", () => {
    render(<EscolhaLugares evento={evento} sessao={sessao} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    const resumos = screen.getAllByRole("region", { name: /Resumo dos lugares/ });
    expect(resumos).toHaveLength(1);
    for (let elemento: HTMLElement | null = resumos[0]!; elemento; elemento = elemento.parentElement) {
      expect(elemento.className.toString().split(/\s+/)).not.toContain("hidden");
    }
  });

  it("no celular, a barra inferior avisa que falta o tipo e leva até a escolha", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<EscolhaLugares evento={evento} sessao={sessao} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    fireEvent.click(screen.getByRole("button", { name: /Escolha Inteira ou Meia/ }));
    expect(scrollIntoView).toHaveBeenCalled();
    const resumo = screen.getByRole("region", { name: /Resumo dos lugares/ });
    fireEvent.click(within(resumo).getByRole("radio", { name: /Meia-entrada/ }));
    expect(screen.queryByRole("button", { name: /Escolha Inteira ou Meia/ })).toBeNull();
  });
});


describe("pacotes na escolha de lugares",()=>{
  afterEach(()=>{cleanup();vi.clearAllMocks();});

it("restaura trinta lugares sem truncar a seleção",()=>{
  const mapa30={...mapa,seats:Array.from({length:30},(_,i)=>({...mapa.seats[0]!,id:`s-${i+1}`,seatNumber:String(i+1),x:i*10}))};
  render(<EscolhaLugares evento={evento} sessao={{...sessao,ticketTypes:[sessao.ticketTypes[0]!]}} map={mapa30} initialSelection={mapa30.seats.map(s=>({seatId:s.id,ticketTypeId:"inteira"}))}/>);
  expect(screen.getAllByRole("radiogroup")).toHaveLength(30);
});
it("oferece pacote por grupo e envia um participante por assento",async()=>{
  vi.mocked(eventosApi.reservarAssentos).mockResolvedValue({reservationId:"reserva",orderNumber:"PED-COMBO",expiresAt:new Date(),subtotalCents:42500,totalCents:42500,offerDiscountCents:0,couponDiscountCents:0,discountCents:0,appliedOffer:null,appliedCoupon:null,items:[]});
  const combo={...sessao.ticketTypes[0]!,id:"combo",name:"Combo 10",lugaresPorPacote:10,priceCents:38000};
  render(<EscolhaLugares evento={evento} sessao={{...sessao,ticketTypes:[sessao.ticketTypes[0]!,combo]}} map={mapa} initialSelection={mapa.seats.slice(0,11).map(s=>({seatId:s.id,ticketTypeId:"inteira"}))}/>);
  fireEvent.click(screen.getByRole("button",{name:"Adicionar pacote Combo 10"}));
  expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
  expect(screen.getAllByText("R$ 425,00").length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole("button",{name:"Continuar"})[0]!);
  await waitFor(()=>expect(eventosApi.reservarAssentos).toHaveBeenCalled());
  const input=vi.mocked(eventosApi.reservarAssentos).mock.calls.at(-1)![0];
  expect(input.seats.filter(s=>s.pacoteId)).toHaveLength(10);
  expect(input.seats.map(s=>s.participantIndex)).toEqual([0,1,2,3,4,5,6,7,8,9,10]);
  expect(input.seats[10]?.ticketTypeId).toBe("inteira");
});
it("desfazer pacote exige nova classificação e não cobra avulsos automaticamente",()=>{
  const combo={...sessao.ticketTypes[0]!,id:"combo",name:"Combo 10",lugaresPorPacote:10,priceCents:38000};
  render(<EscolhaLugares evento={evento} sessao={{...sessao,ticketTypes:[sessao.ticketTypes[0]!,combo]}} map={mapa} initialSelection={mapa.seats.slice(0,10).map(s=>({seatId:s.id,ticketTypeId:"inteira"}))}/>);
  fireEvent.click(screen.getByRole("button",{name:"Adicionar pacote Combo 10"}));
  fireEvent.click(screen.getByRole("button",{name:"Desfazer pacote Combo 10"}));
  expect(screen.getAllByRole("button",{name:"Continuar"}).every(b=>(b as HTMLButtonElement).disabled)).toBe(true);
  expect(screen.getAllByRole("radio").every(b=>!(b as HTMLInputElement).checked)).toBe(true);
});
it("sessão só com combos não os atribui automaticamente a um assento",()=>{
  const combo={...sessao.ticketTypes[0]!,id:"combo",name:"Combo 10",lugaresPorPacote:10,priceCents:38000};
  render(<EscolhaLugares evento={evento} sessao={{...sessao,ticketTypes:[combo]}} map={mapa}/>);
  fireEvent.click(screen.getByRole("button",{name:/Fileira G, assento 19/}));
  expect(screen.getAllByRole("button",{name:"Continuar"}).every(b=>(b as HTMLButtonElement).disabled)).toBe(true);
  expect(screen.queryByRole("radio")).toBeNull();
});

  it("perda de lugar na atualização desfaz só seu pacote e mantém o outro",async()=>{
    const combo={...sessao.ticketTypes[0]!,id:"combo",name:"Combo 10",lugaresPorPacote:10,priceCents:38000};
    vi.mocked(eventosApi.reservarAssentos).mockRejectedValue(new eventosApi.EventosApiError("indisponível",409,"SEAT_UNAVAILABLE"));
    vi.mocked(eventosApi.obterMapaSessao).mockResolvedValue({...mapa,seats:mapa.seats.map(s=>s.id==="s-1"?{...s,state:"sold" as const}:s)});
    render(<EscolhaLugares evento={evento} sessao={{...sessao,ticketTypes:[sessao.ticketTypes[0]!,combo]}} map={mapa} initialSelection={mapa.seats.slice(0,20).map((s,i)=>({seatId:s.id,ticketTypeId:"combo",pacoteId:i<10?"p1":"p2"}))}/>);
    fireEvent.click(screen.getAllByRole("button",{name:"Continuar"})[0]!);
    await waitFor(()=>expect(screen.getAllByRole("radiogroup")).toHaveLength(9));
    expect(screen.getAllByRole("button",{name:"Desfazer pacote Combo 10"})).toHaveLength(1);
    expect(screen.getAllByRole("radio").every(r=>!(r as HTMLInputElement).checked)).toBe(true);
    expect(screen.getAllByRole("button",{name:"Continuar"}).every(b=>(b as HTMLButtonElement).disabled)).toBe(true);
  });

});
