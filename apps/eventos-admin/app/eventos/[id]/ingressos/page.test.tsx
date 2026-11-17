// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import IngressosPage from "./page";

vi.mock("next/navigation",()=>({useParams:()=>({id:"evento"}),useRouter:()=>({refresh:vi.fn()})}));
let payload: Array<{ id: string; lugaresPorPacote: number; maxPerOrder: number | null }> | null;
beforeEach(()=>{
  payload = null;
  vi.stubGlobal("fetch",vi.fn(async (url: string, init?: RequestInit)=>{
    if(init?.method === "PATCH") {
      payload = JSON.parse(String(init.body));
      return new Response(JSON.stringify({success:true,data:payload}),{status:200});
    }
    return new Response(JSON.stringify(url.endsWith("/cupons") ? [] : [{id:"00000000-0000-4000-8000-000000000001",name:"Inteira",priceCents:38000,maxPerOrder:null}]),{status:200});
  }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("carrega avulso legado e autosalva quantidade sem recriar o tipo",async()=>{
  render(<IngressosPage/>);
  const campo = await screen.findByRole("spinbutton",{name:"Lugares por pacote"});
  expect((campo as HTMLInputElement).value).toBe("1");
  fireEvent.change(campo,{target:{value:"10"}});
  await waitFor(()=>expect(payload?.[0]).toMatchObject({id:"00000000-0000-4000-8000-000000000001",lugaresPorPacote:10,maxPerOrder:null}),{timeout:3000});
  expect(screen.getByText("Preço total do pacote")).toBeTruthy();
});
it("sinaliza quantidade inválida e limite incompatível sem impor teto ao pacote",async()=>{
  render(<IngressosPage/>);
  const campo = await screen.findByRole("spinbutton",{name:"Lugares por pacote"});
  fireEvent.change(campo,{target:{value:"0"}});
  expect(screen.getByText("Informe uma quantidade inteira de lugares maior que zero.")).toBeTruthy();
  fireEvent.change(campo,{target:{value:"30"}});
  fireEvent.change(screen.getByRole("spinbutton",{name:"Limite de lugares deste tipo por pedido (opcional)"}),{target:{value:"20"}});
  expect(screen.getByText("O limite configurado não permite comprar um pacote completo.")).toBeTruthy();
});
