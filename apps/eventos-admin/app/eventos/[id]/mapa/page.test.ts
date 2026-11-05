// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MapaPage from "./page";
import type { TravaMapa, VersaoMapaResumo } from "../../../../features/eventos/conferencia/api-mapas";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "evento-1" }), useRouter: () => ({ refresh }) }));
vi.mock("next/font/google", () => ({ Outfit: () => ({ variable: "fonte-display" }), DM_Sans: () => ({ variable: "fonte-corpo" }) }));
vi.mock("../../../../features/eventos/conferencia/planta-pdf", () => ({ PlantaPdf: () => React.createElement("div", { "data-testid": "planta-pdf" }) }));

const BASE = "/eventos-admin/api/eventos/admin/evento-1";
type Chamada = { metodo: string; caminho: string; init?: RequestInit };
type Rota = (chamada: Chamada) => Response | Promise<Response>;
const envelope = (data: unknown, status = 200) => new Response(JSON.stringify({ success: status < 400, data }), { status });
const erroApi = (code: string, message: string, status = 409) => new Response(JSON.stringify({ success: false, error: { code, message } }), { status });

const proposta = (): PropostaMapa => ({
  versao: 1, revisao: 0, pagina: { numero: 1, largura: 1000, altura: 700 },
  lugares: [{ id: "l1", fileira: "A", numero: "1", x: 100, y: 100, largura: 20, altura: 20, rotacao: 0, blocoId: null, cor: "#c1", categoriaManual: null, acessoExternoManual: null, vender: true, origem: "GERADOR" }],
  rotulos: [], elementos: [], legenda: [{ cor: "#c1", texto: "Comum", quantidade: 1, categoria: "COMUM", acessoExterno: false, confirmada: true }], pontos: [],
});

let chamadas: Chamada[];
function servidor(rotas: Record<string, Rota>) {
  chamadas = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const caminho = String(input).replace(BASE, "");
    const chamada = { metodo: init?.method ?? "GET", caminho, init };
    chamadas.push(chamada);
    const rota = rotas[`${chamada.metodo} ${caminho}`];
    if (!rota) throw new Error(`Rota inesperada: ${chamada.metodo} ${caminho}`);
    return rota(chamada);
  }));
}
const chamadasEm = (metodo: string, caminho: string) => chamadas.filter((c) => c.metodo === metodo && c.caminho === caminho);
const versaoAtual: VersaoMapaResumo = { id: "m1", version: 1, status: "CONFIRMADO", originalFileName: "planta.pdf", createdAt: "2026-11-01T10:00:00Z", confirmedAt: "2026-11-01T11:00:00Z", atual: true, lugares: 1, sessoes: [{ id: "s1", startsAt: "2026-12-01T10:00:00Z" }], editavel: true };
const versaoRevisao: VersaoMapaResumo = { ...versaoAtual, id: "m2", version: 2, status: "EM_REVISAO", atual: false, sessoes: [], editavel: false };
const lista = (versoes: VersaoMapaResumo[] = [versaoAtual], trava: TravaMapa = { tipo: "LIVRE", mensagem: null }) => envelope({ versoes, trava });
function rotasBase(extras: Record<string, Rota> = {}) { return { "GET /mapas": () => lista(), ...extras }; }
const entrar = () => render(React.createElement(MapaPage));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => refresh.mockReset());

describe("MapaPage versões", () => {
  it("mostra as versões com selo, lugares e sessões", async () => {
    servidor(rotasBase()); entrar();
    expect(await screen.findByText("Versão 1")).toBeTruthy();
    expect(screen.getByText("Atual")).toBeTruthy(); expect(screen.getByText("1 lugar")).toBeTruthy(); expect(screen.getByText(/01\/12\/2026/)).toBeTruthy();
  });

  it("Editar chama POST editar e abre a conferência da versão nova", async () => {
    servidor(rotasBase({ "POST /mapas/m1/editar": () => envelope({ mapId: "m2" }), "GET /mapas/m2/revisao": () => envelope({ map: { id: "m2", status: "EM_REVISAO" }, proposta: proposta() }) })); entrar();
    fireEvent.click(await screen.findByRole("button", { name: "Editar versão 1" }));
    expect(await screen.findByRole("heading", { name: "Conferência do mapa de lugares" })).toBeTruthy(); expect(chamadasEm("POST", "/mapas/m1/editar")).toHaveLength(1);
  });

  it("Excluir confirma, chama DELETE e recarrega a lista", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true); let removida = false;
    servidor({ "GET /mapas": () => lista(removida ? [] : [versaoAtual, { ...versaoAtual, id: "m0", version: 0, atual: false }]), "DELETE /mapas/m0": () => { removida = true; return envelope({ excluida: true, sessionIds: [] }); } }); entrar();
    expect(await screen.findByRole("button", { name: "Excluir versão 0" })).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Excluir versão 0" }));
    await waitFor(() => expect(chamadasEm("DELETE", "/mapas/m0")).toHaveLength(1)); expect(chamadasEm("GET", "/mapas").length).toBeGreaterThan(1);
  });

  it("usa o prompt exato para excluir uma versão", async () => {
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);
    servidor({ "GET /mapas": () => lista([versaoAtual, { ...versaoAtual, id: "m0", version: 0, atual: false }]) }); entrar();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir versão 0" }));
    expect(confirmar).toHaveBeenCalledWith("Excluir a versão 0? Esta ação não pode ser desfeita.");
  });

  it("mostra Publicada e Arquivada nas versões que não são atuais", async () => {
    servidor({ "GET /mapas": () => lista([versaoAtual, { ...versaoAtual, id: "m2", version: 2, atual: false }, { ...versaoAtual, id: "m3", version: 3, status: "ARQUIVADO", atual: false }]) }); entrar();
    await screen.findByText("Versão 1");
    expect(screen.getByText("Publicada")).toBeTruthy(); expect(screen.getByText("Arquivada")).toBeTruthy();
  });

  it("com venda confirmada, Editar, Excluir e Enviar nova planta ficam desabilitados com a mensagem", async () => {
    servidor({ "GET /mapas": () => lista([versaoAtual, { ...versaoAtual, id: "m0", version: 0, atual: false }], { tipo: "VENDA_CONFIRMADA", mensagem: "Bloqueado: já há lugares vendidos com pagamento confirmado neste evento." }) }); entrar();
    expect((await screen.findByRole("alert")).textContent).toContain("Bloqueado: já há lugares vendidos"); expect((screen.getByRole("button", { name: "Editar versão 1" }) as HTMLButtonElement).disabled).toBe(true); expect((screen.getByRole("button", { name: "Excluir versão 0" }) as HTMLButtonElement).disabled).toBe(true); expect((screen.getByLabelText("Enviar nova planta") as HTMLInputElement).disabled).toBe(true);
  });

  it("COMPRA_EM_ANDAMENTO no clique mostra a mensagem e recarrega a lista", async () => {
    let tentativas = 0;
    servidor({ "GET /mapas": () => lista([versaoAtual], tentativas ? { tipo: "COMPRA_EM_ANDAMENTO", mensagem: "Há uma compra em andamento neste evento. Tente de novo em alguns minutos." } : { tipo: "LIVRE", mensagem: null }), "POST /mapas/m1/editar": () => { tentativas += 1; return erroApi("COMPRA_EM_ANDAMENTO", "Há uma compra em andamento neste evento. Tente de novo em alguns minutos."); } }); entrar();
    fireEvent.click(await screen.findByRole("button", { name: "Editar versão 1" })); expect((await screen.findAllByRole("alert"))[0].textContent).toContain("Há uma compra em andamento"); await waitFor(() => expect(chamadasEm("GET", "/mapas").length).toBeGreaterThan(1));
  });

  it("com trava ativa na conferência desabilita publicar e enviar outra planta", async () => {
    servidor({ "GET /mapas": () => lista([versaoRevisao], { tipo: "COMPRA_EM_ANDAMENTO", mensagem: "Há uma compra em andamento neste evento. Tente de novo em alguns minutos." }), "GET /mapas/m2/revisao": () => envelope({ map: { id: "m2", status: "EM_REVISAO" }, proposta: proposta() }) }); entrar();
    expect(await screen.findByRole("heading", { name: "Conferência do mapa de lugares" })).toBeTruthy();
    expect((await screen.findAllByRole("alert"))[0].textContent).toContain("Há uma compra em andamento");
    expect((screen.getByRole("button", { name: "Publicar mapa" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Enviar outra planta" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("recusa publicar, recarrega a trava e mantém a conferência bloqueada", async () => {
    let recusada = false;
    servidor({
      "GET /mapas": () => lista([versaoRevisao], recusada ? { tipo: "VENDA_CONFIRMADA", mensagem: "Bloqueado: já há lugares vendidos com pagamento confirmado neste evento." } : { tipo: "LIVRE", mensagem: null }),
      "GET /mapas/m2/revisao": () => envelope({ map: { id: "m2", status: "EM_REVISAO" }, proposta: proposta() }),
      "POST /mapas/m2/publicar": () => { recusada = true; return erroApi("VENDA_CONFIRMADA", "Bloqueado: já há lugares vendidos com pagamento confirmado neste evento."); },
    }); entrar();
    const publicar = await screen.findByRole("button", { name: "Publicar mapa" }); await waitFor(() => expect((publicar as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(publicar); const confirmar = await screen.findByRole("button", { name: "Confirmar publicação" }); await waitFor(() => expect((confirmar as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(confirmar);
    expect(await screen.findByRole("heading", { name: "Conferência do mapa de lugares" })).toBeTruthy(); expect((await screen.findAllByRole("alert"))[0].textContent).toContain("Bloqueado: já há lugares vendidos"); await waitFor(() => expect((screen.getByRole("button", { name: "Publicar mapa" }) as HTMLButtonElement).disabled).toBe(true));
  });

  it("publicar mostra o resumo com sessões e capacidade e volta para a lista", async () => {
    servidor({ "GET /mapas": () => lista([versaoRevisao]), "GET /mapas/m2/revisao": () => envelope({ map: { id: "m2", status: "EM_REVISAO" }, proposta: proposta() }), "POST /mapas/m2/publicar": () => envelope({ sessionIds: ["s1", "s2"], capacidade: 4, arquivadas: [] }) }); entrar();
    const publicar = await screen.findByRole("button", { name: "Publicar mapa" }); await waitFor(() => expect((publicar as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(publicar); const confirmar = await screen.findByRole("button", { name: "Confirmar publicação" }); await waitFor(() => expect((confirmar as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(confirmar); await waitFor(() => expect(chamadasEm("POST", "/mapas/m2/publicar")).toHaveLength(1));
    expect((await screen.findByRole("status")).textContent).toContain("Publicado: 2 sessão(ões) levada(s) para a versão 2. Capacidade: 4 lugares."); await waitFor(() => expect(chamadasEm("GET", "/mapas").length).toBeGreaterThan(1));
  });

  it("Editar e publicar usa o número da versão recarregada", async () => {
    let editado = false; let publicado = false;
    const m2: VersaoMapaResumo = { ...versaoRevisao, version: 4 };
    servidor({
      "GET /mapas": () => editado ? lista([publicado ? { ...m2, status: "CONFIRMADO", atual: true } : m2]) : lista([versaoAtual]),
      "POST /mapas/m1/editar": () => { editado = true; return envelope({ mapId: "m2" }); },
      "GET /mapas/m2/revisao": () => envelope({ map: { id: "m2", status: "EM_REVISAO" }, proposta: proposta() }),
      "POST /mapas/m2/publicar": () => { publicado = true; return envelope({ sessionIds: ["s1", "s2"], capacidade: 4, arquivadas: [] }); },
    }); entrar(); fireEvent.click(await screen.findByRole("button", { name: "Editar versão 1" }));
    const publicar = await screen.findByRole("button", { name: "Publicar mapa" }); await waitFor(() => expect((publicar as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(publicar); const confirmar = await screen.findByRole("button", { name: "Confirmar publicação" }); await waitFor(() => expect((confirmar as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(confirmar);
    expect((await screen.findByRole("status")).textContent).toContain("versão 4");
  });

  it("Enviar nova planta e publicar usa o número da versão recarregada", async () => {
    let enviada = false; let publicada = false;
    const m2: VersaoMapaResumo = { ...versaoRevisao, version: 5 };
    servidor({
      "GET /mapas": () => enviada ? lista([publicada ? { ...m2, status: "CONFIRMADO", atual: true } : m2]) : lista([versaoAtual]),
      "POST /mapas/import": () => { enviada = true; return envelope({ mapId: "m2" }); },
      "GET /mapas/m2/revisao": () => envelope({ map: { id: "m2", status: "EM_REVISAO" }, proposta: proposta() }),
      "POST /mapas/m2/publicar": () => { publicada = true; return envelope({ sessionIds: ["s1"], capacidade: 1, arquivadas: [] }); },
    }); entrar(); fireEvent.change(await screen.findByLabelText("Enviar nova planta"), { target: { files: [new File(["%PDF"], "nova.pdf", { type: "application/pdf" })] } });
    const publicar = await screen.findByRole("button", { name: "Publicar mapa" }); await waitFor(() => expect((publicar as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(publicar); const confirmar = await screen.findByRole("button", { name: "Confirmar publicação" }); await waitFor(() => expect((confirmar as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(confirmar);
    expect((await screen.findByRole("status")).textContent).toContain("versão 5");
  });

  it("desabilita Enviar página escolhida quando a trava é recarregada", async () => {
    let consultadas = 0;
    servidor({
      "GET /mapas": () => { consultadas += 1; return lista([], consultadas > 1 ? { tipo: "COMPRA_EM_ANDAMENTO", mensagem: "Há uma compra em andamento neste evento. Tente de novo em alguns minutos." } : { tipo: "LIVRE", mensagem: null }); },
      "POST /mapas/import": () => new Response(JSON.stringify({ success: false, error: { code: "PDF_PAGINA_OBRIGATORIA", message: "Escolha a página", details: { paginas: 2 } } }), { status: 400 }),
    }); entrar();
    fireEvent.change(await screen.findByLabelText("Enviar planta em PDF"), { target: { files: [new File(["%PDF"], "nova.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText("Escolha a página da planta")).toBeTruthy(); expect((screen.getByRole("button", { name: "Enviar página escolhida" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("não chama mais mapa-padrao, substituir nem migrar-e-excluir", async () => { servidor(rotasBase()); entrar(); await screen.findByText("Versão 1"); expect(chamadas.some((c) => c.caminho.includes("mapa-padrao") || c.caminho.includes("migrar-e-excluir"))).toBe(false); });
});
