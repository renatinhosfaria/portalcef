// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { aplicarOperacoes, type PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MapaPage from "./page";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "evento-1" }), useRouter: () => ({ refresh }) }));
vi.mock("next/font/google", () => ({ Outfit: () => ({ variable: "fonte-display" }), DM_Sans: () => ({ variable: "fonte-corpo" }) }));
vi.mock("../../../../features/eventos/conferencia/planta-pdf", () => ({ PlantaPdf: () => React.createElement("div", { "data-testid": "planta-pdf" }) }));

const BASE = "/eventos-admin/api/eventos/admin/evento-1";
type Chamada = { metodo: string; caminho: string; consulta: string; init?: RequestInit };
type Rota = (chamada: Chamada) => Response | Promise<Response>;

const envelope = (data: unknown, status = 200) => new Response(JSON.stringify({ success: status < 400, data }), { status, headers: { "content-type": "application/json" } });
const erroApi = (code: string, message: string, details?: unknown, status = 409) =>
  new Response(JSON.stringify({ success: false, error: { code, message, details } }), { status, headers: { "content-type": "application/json" } });

function lugar(id: string, fileira: string, numero: string, x: number) {
  return { id, fileira, numero, x, y: 1000, largura: 200, altura: 200, rotacao: 0, blocoId: null, cor: "#c1", categoriaManual: null, acessoExternoManual: null, vender: true, origem: "GERADOR" as const };
}
function propostaPendente(): PropostaMapa {
  return {
    versao: 1, revisao: 3, pagina: { numero: 1, largura: 8420, altura: 5950 },
    lugares: [lugar("l1", "A", "1", 1000), lugar("l2", "A", "2", 1300)],
    rotulos: [], elementos: [],
    legenda: [{ cor: "#c1", texto: "Comum", quantidade: 2, categoria: "COMUM", acessoExterno: false, confirmada: true }],
    pontos: [{ id: "p1", tipo: "SALTO_NUMERACAO", mensagem: "Fileira A pulou um número", lugarIds: ["l1", "l2"], conferido: false }],
  };
}
function propostaLimpa(): PropostaMapa {
  const base = propostaPendente();
  return { ...base, pontos: base.pontos.map((p) => ({ ...p, conferido: true })) };
}

const substituicao = { inheritedSessionIds: ["sessao-1"], inventorySessionIds: ["sessao-1"], inventoryCreatedCount: 2, previousMapArchive: { archived: true, code: "ARCHIVED" as const } };
const substituicaoEmUso = { inheritedSessionIds: [], inventorySessionIds: [], inventoryCreatedCount: 0, previousMapId: "mapa-anterior", previousMapArchive: { archived: false, code: "MAP_IN_USE" as const, sessionIds: ["sessao-1", "sessao-2"] } };
const migracao = { oldMapId: "mapa-anterior", targetMapId: "m1", migratedSessionIds: ["sessao-1", "sessao-2"], inheritedSessionIds: [], inventoryCreatedCount: 8, deletedMap: { deleted: true, code: "DELETED" as const } };

let chamadas: Chamada[];
function servidor(rotas: Record<string, Rota>) {
  chamadas = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const [caminhoCompleto, consulta = ""] = String(input).split("?");
    const caminho = caminhoCompleto.replace(BASE, "");
    const metodo = init?.method ?? "GET";
    const chamada = { metodo, caminho, consulta, init };
    chamadas.push(chamada);
    const rota = rotas[`${metodo} ${caminho}`];
    if (!rota) throw new Error(`Rota inesperada: ${metodo} ${caminho}`);
    return rota(chamada);
  }));
}
const corpo = (c?: Chamada) => JSON.parse(String(c?.init?.body));
const chamadasEm = (metodo: string, caminho: string) => chamadas.filter((c) => c.metodo === metodo && c.caminho === caminho);
const pdf = (nome = "planta.pdf") => new File(["%PDF"], nome, { type: "application/pdf" });

function rotasPadrao(extras: Record<string, Rota> = {}): Record<string, Rota> {
  return {
    "GET ": () => envelope({ defaultMapId: null }),
    "GET /mapas": () => envelope([]),
    ...extras,
  };
}
/** Evento sem mapa publicado e com a versão m1 em revisão. */
function rotasEmRevisao(proposta: PropostaMapa, extras: Record<string, Rota> = {}) {
  return rotasPadrao({
    "GET /mapas": () => envelope([{ id: "m1", version: 1, status: "EM_REVISAO", originalFileName: "planta.pdf" }]),
    "GET /mapas/m1/revisao": () => envelope({ map: { id: "m1", status: "EM_REVISAO" }, proposta }),
    ...extras,
  });
}
async function publicar() {
  fireEvent.click(await screen.findByRole("button", { name: "Publicar mapa" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar publicação" }));
}
const entrar = () => render(React.createElement(MapaPage));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => { refresh.mockReset(); });

describe("MapaPage estados", () => {
  it("retoma a conferência da versão EM_REVISAO mais nova", async () => {
    servidor(rotasPadrao({
      "GET /mapas": () => envelope([
        { id: "m2", version: 2, status: "EM_REVISAO", originalFileName: "b.pdf" },
        { id: "m1", version: 1, status: "EM_REVISAO", originalFileName: "a.pdf" },
      ]),
      "GET /mapas/m2/revisao": () => envelope({ map: { id: "m2", status: "EM_REVISAO" }, proposta: propostaLimpa() }),
    }));
    entrar();
    expect(await screen.findByRole("heading", { name: "Conferência do mapa de lugares" })).toBeTruthy();
    expect(chamadasEm("GET", "/mapas/m1/revisao")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Publicar mapa" })).toBeTruthy();
  });

  it("sem mapa mostra só o envio", async () => {
    servidor(rotasPadrao());
    entrar();
    const entrada = (await screen.findByLabelText("Enviar planta em PDF")) as HTMLInputElement;
    expect(entrada.accept).toBe("application/pdf");
    expect(screen.queryByRole("button", { name: "Publicar mapa" })).toBeNull();
  });

  it("mapa padrão confirmado sem proposta mostra o aviso de mapa antigo e o envio", async () => {
    servidor(rotasPadrao({
      "GET ": () => envelope({ defaultMapId: "antigo" }),
      "GET /mapas": () => envelope([{ id: "antigo", version: 1, status: "CONFIRMADO", originalFileName: null }]),
      "GET /mapas/antigo/revisao": () => envelope({ map: { id: "antigo", status: "CONFIRMADO" }, proposta: null }),
      "PATCH /mapa-padrao": () => envelope({ inheritedSessionIds: [], inventorySessionIds: [], inventoryCreatedCount: 0 }),
    }));
    entrar();
    expect(await screen.findByText("Este mapa foi criado pela versão anterior do gerador. Envie a planta em PDF para gerar o mapa novo.")).toBeTruthy();
    expect(screen.getByLabelText("Enviar planta em PDF")).toBeTruthy();
  });

  it("mapa padrão confirmado com proposta mostra o mapa só para leitura, o resumo e sincroniza sem substituir", async () => {
    servidor(rotasPadrao({
      "GET ": () => envelope({ defaultMapId: "m1" }),
      "GET /mapas": () => envelope([{ id: "m1", version: 1, status: "CONFIRMADO", originalFileName: "planta.pdf" }]),
      "GET /mapas/m1/revisao": () => envelope({ map: { id: "m1", status: "CONFIRMADO" }, proposta: propostaLimpa() }),
      "PATCH /mapa-padrao": () => envelope({ inheritedSessionIds: [], inventorySessionIds: [], inventoryCreatedCount: 0 }),
    }));
    entrar();
    expect(await screen.findByLabelText("Enviar nova planta")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Resumo da proposta" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Mapa de lugares publicado" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "A-1, Comum" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "A-1, Comum" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publicar mapa" })).toBeNull();
    expect(chamadasEm("POST", "/mapa-padrao/substituir")).toHaveLength(0);
    expect(chamadasEm("PATCH", "/mapa-padrao")).toHaveLength(1);
    expect(corpo(chamadasEm("PATCH", "/mapa-padrao")[0])).toEqual({ mapId: "m1" });
  });

  it("recupera no carregamento a ação de migrar quando o PATCH encontra MAP_IN_USE", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    servidor(rotasPadrao({
      "GET ": () => envelope({ defaultMapId: "m1" }),
      "GET /mapas": () => envelope([{ id: "m1", version: 1, status: "CONFIRMADO", originalFileName: "planta.pdf" }]),
      "GET /mapas/m1/revisao": () => envelope({ map: { id: "m1", status: "CONFIRMADO" }, proposta: propostaLimpa() }),
      "PATCH /mapa-padrao": () => envelope(substituicaoEmUso),
      "POST /mapas/mapa-anterior/migrar-e-excluir": () => envelope(migracao),
    }));
    entrar();
    fireEvent.click(await screen.findByRole("button", { name: "Migrar sessões e excluir mapa anterior" }));
    await waitFor(() => expect(screen.getByText(/mapa anterior excluído/i)).toBeTruthy());
    expect(screen.queryByText(/Revise o inventário/)).toBeNull();
  });
});

describe("MapaPage envio da planta", () => {
  it("PDF com várias páginas pede a página e reenvia com ?pagina", async () => {
    const primeiro = pdf();
    servidor(rotasPadrao({
      "POST /mapas/import": ({ consulta }) => (consulta === "" ? erroApi("PDF_PAGINA_OBRIGATORIA", "Escolha a página", { paginas: 3 }, 400) : envelope({ mapId: "m1" })),
      "GET /mapas/m1/revisao": () => envelope({ map: { id: "m1", status: "EM_REVISAO" }, proposta: propostaLimpa() }),
    }));
    entrar();
    fireEvent.change(await screen.findByLabelText("Enviar planta em PDF"), { target: { files: [primeiro] } });
    expect(await screen.findByText("Escolha a página da planta")).toBeTruthy();
    const seletor = screen.getByRole("combobox", { name: "Página da planta" }) as HTMLSelectElement;
    expect(within(seletor).getAllByRole("option").map((o) => o.textContent)).toEqual(["1", "2", "3"]);
    fireEvent.change(seletor, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar página escolhida" }));
    expect(await screen.findByRole("heading", { name: "Conferência do mapa de lugares" })).toBeTruthy();
    const importacoes = chamadasEm("POST", "/mapas/import");
    expect(importacoes.map((c) => c.consulta)).toEqual(["", "pagina=2"]);
    expect((importacoes[1].init?.body as FormData).get("file")).toBe(primeiro);
  });

  it("mostra a mensagem da API quando a planta não tem números", async () => {
    servidor(rotasPadrao({
      "POST /mapas/import": () => erroApi("PLANTA_SEM_NUMEROS", "Não encontramos números de lugares nesta planta.", undefined, 422),
    }));
    entrar();
    fireEvent.change(await screen.findByLabelText("Enviar planta em PDF"), { target: { files: [pdf()] } });
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe("Não encontramos números de lugares nesta planta.");
  });

  it("enviar outra planta com conferência aberta passa a mostrar a nova", async () => {
    const nova = { ...propostaLimpa(), lugares: [lugar("n1", "Z", "9", 1000)], pontos: [] };
    servidor(rotasEmRevisao(propostaPendente(), {
      "POST /mapas/import": () => envelope({ mapId: "m2" }),
      "GET /mapas/m2/revisao": () => envelope({ map: { id: "m2", status: "EM_REVISAO" }, proposta: nova }),
    }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    entrar();
    expect(await screen.findByRole("button", { name: /Fileira A pulou um número/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar outra planta" }));
    fireEvent.change(screen.getByLabelText("Arquivo da nova planta"), { target: { files: [pdf("outra.pdf")] } });
    await waitFor(() => expect(screen.queryByRole("button", { name: /Fileira A pulou um número/ })).toBeNull());
    expect(await screen.findByRole("button", { name: "Z-9, Comum" })).toBeTruthy();
  });

  it("limpa a pendência e os avisos da troca anterior ao começar um novo envio", async () => {
    let tentativas = 0;
    servidor(rotasEmRevisao(propostaLimpa(), {
      "POST /mapas/m1/publicar": () => envelope({}),
      "POST /mapa-padrao/substituir": () => (++tentativas === 1 ? erroApi("FALHA", "Falhou", undefined, 500) : envelope(substituicao)),
      "POST /mapas/import": () => envelope({ mapId: "m2" }),
      "GET /mapas/m2/revisao": () => envelope({ map: { id: "m2", status: "EM_REVISAO" }, proposta: propostaLimpa() }),
    }));
    entrar();
    await publicar();
    await screen.findByRole("button", { name: "Substituir mapa padrão novamente" });
    fireEvent.change(await screen.findByLabelText("Enviar nova planta"), { target: { files: [pdf()] } });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Substituir mapa padrão novamente" })).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("MapaPage publicação", () => {
  it("publica uma vez mesmo com clique duplo e substitui o mapa padrão com o mesmo mapId", async () => {
    let liberar!: (r: Response) => void;
    const pendente = new Promise<Response>((r) => { liberar = r; });
    let publicado = false;
    const base = rotasEmRevisao(propostaLimpa(), {
      "POST /mapas/m1/publicar": () => pendente,
      "POST /mapa-padrao/substituir": () => { publicado = true; return envelope(substituicao); },
    });
    // Depois da publicação, a lista e a revisão passam a mostrar o mapa confirmado.
    servidor({
      ...base,
      "GET /mapas": (c) => (publicado ? envelope([{ id: "m1", version: 1, status: "CONFIRMADO", originalFileName: "planta.pdf" }]) : base["GET /mapas"](c)),
      "GET /mapas/m1/revisao": (c) => (publicado ? envelope({ map: { id: "m1", status: "CONFIRMADO" }, proposta: propostaLimpa() }) : base["GET /mapas/m1/revisao"](c)),
    });
    entrar();
    fireEvent.click(await screen.findByRole("button", { name: "Publicar mapa" }));
    const confirmar = await screen.findByRole("button", { name: "Confirmar publicação" });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    expect(chamadasEm("POST", "/mapas/m1/publicar")).toHaveLength(1);
    expect(corpo(chamadasEm("POST", "/mapas/m1/publicar")[0])).toMatchObject({ revisaoBase: 3 });
    liberar(envelope({}));
    await waitFor(() => expect(publicado).toBe(true));
    expect(chamadasEm("POST", "/mapas/m1/publicar")).toHaveLength(1);
    expect(chamadasEm("POST", "/mapa-padrao/substituir")).toHaveLength(1);
    expect(corpo(chamadasEm("POST", "/mapa-padrao/substituir")[0])).toEqual({ mapId: "m1" });
    expect(await screen.findByLabelText("Enviar nova planta")).toBeTruthy();
    expect(screen.getByText(/versão anterior arquivada/i)).toBeTruthy();
    expect(chamadasEm("GET", "/mapas").length).toBeGreaterThanOrEqual(2);
  });

  it("mantém o mapId no retry da substituição, sem novo envio nem nova publicação", async () => {
    let tentativas = 0;
    servidor(rotasEmRevisao(propostaLimpa(), {
      "POST /mapas/m1/publicar": () => envelope({}),
      "POST /mapa-padrao/substituir": () => (++tentativas === 1 ? erroApi("FALHA", "Falhou", undefined, 500) : envelope(substituicao)),
    }));
    entrar();
    await publicar();
    const retry = await screen.findByRole("button", { name: "Substituir mapa padrão novamente" });
    expect(screen.getByRole("alert").textContent).toMatch(/versão confirmada foi preservada/i);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText(/versão anterior arquivada/i)).toBeTruthy());
    const subs = chamadasEm("POST", "/mapa-padrao/substituir");
    expect(subs.map(corpo)).toEqual([{ mapId: "m1" }, { mapId: "m1" }]);
    expect(chamadasEm("POST", "/mapas/m1/publicar")).toHaveLength(1);
    expect(chamadasEm("POST", "/mapas/import")).toHaveLength(0);
  });

  it("atualiza a falha do retry e preserva a pendência", async () => {
    servidor(rotasEmRevisao(propostaLimpa(), {
      "POST /mapas/m1/publicar": () => envelope({}),
      "POST /mapa-padrao/substituir": () => erroApi("FALHA", "Falhou", undefined, 500),
    }));
    entrar();
    await publicar();
    fireEvent.click(await screen.findByRole("button", { name: "Substituir mapa padrão novamente" }));
    await waitFor(() => expect(chamadasEm("POST", "/mapa-padrao/substituir")).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/versão confirmada foi preservada/i));
    expect(screen.getByRole("button", { name: "Substituir mapa padrão novamente" })).toBeTruthy();
  });

  it("oferece migrar e excluir quando o mapa anterior está em uso e envia targetMapId e sessionIds", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    servidor(rotasEmRevisao(propostaLimpa(), {
      "POST /mapas/m1/publicar": () => envelope({}),
      "POST /mapa-padrao/substituir": () => envelope(substituicaoEmUso),
      "POST /mapas/mapa-anterior/migrar-e-excluir": () => envelope(migracao),
    }));
    entrar();
    await publicar();
    fireEvent.click(await screen.findByRole("button", { name: "Migrar sessões e excluir mapa anterior" }));
    await waitFor(() => expect(screen.getByText(/mapa anterior excluído/i)).toBeTruthy());
    expect(corpo(chamadasEm("POST", "/mapas/mapa-anterior/migrar-e-excluir")[0])).toEqual({ targetMapId: "m1", sessionIds: ["sessao-1", "sessao-2"] });
    expect(chamadasEm("POST", "/mapas/import")).toHaveLength(0);
    expect(screen.getAllByText(/2 sessão/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Revise o inventário/)).toBeNull();
  });

  it("não chama a migração quando a confirmação é cancelada", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    servidor(rotasEmRevisao(propostaLimpa(), {
      "POST /mapas/m1/publicar": () => envelope({}),
      "POST /mapa-padrao/substituir": () => envelope(substituicaoEmUso),
      "POST /mapas/mapa-anterior/migrar-e-excluir": () => envelope({}),
    }));
    entrar();
    await publicar();
    fireEvent.click(await screen.findByRole("button", { name: "Migrar sessões e excluir mapa anterior" }));
    await waitFor(() => expect(screen.getByText(/mapa anterior foi preservado/i)).toBeTruthy());
    expect(chamadasEm("POST", "/mapas/mapa-anterior/migrar-e-excluir")).toHaveLength(0);
  });

  it("preserva MAP_IN_USE e mostra CODE: mensagem quando a migração é bloqueada por dependência", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    servidor(rotasEmRevisao(propostaLimpa(), {
      "POST /mapas/m1/publicar": () => envelope({}),
      "POST /mapa-padrao/substituir": () => envelope(substituicaoEmUso),
      "POST /mapas/mapa-anterior/migrar-e-excluir": () => erroApi("SESSION_HAS_DEPENDENCIES", "A sessão possui dependências"),
    }));
    entrar();
    await publicar();
    fireEvent.click(await screen.findByRole("button", { name: "Migrar sessões e excluir mapa anterior" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("SESSION_HAS_DEPENDENCIES: A sessão possui dependências"));
    expect(screen.getByText(/mapa anterior foi preservado/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Migrar sessões e excluir mapa anterior" })).toBeTruthy();
  });
});

describe("MapaPage identidade da proposta", () => {
  it("re-renderizar a página não reinicia a conferência e a edição feita não some", async () => {
    let atual = propostaPendente();
    servidor(rotasEmRevisao(atual, {
      "PATCH /mapas/m1/proposta": ({ init }) => {
        atual = aplicarOperacoes(atual, JSON.parse(String(init?.body)).operacoes);
        return envelope(atual);
      },
    }));
    const { rerender } = entrar();
    fireEvent.click(await screen.findByRole("button", { name: /Fileira A pulou um número/ }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar como conferido" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /✓ Fileira A pulou um número/ })).toBeTruthy());
    await waitFor(() => expect(chamadasEm("PATCH", "/mapas/m1/proposta")).toHaveLength(1));
    rerender(React.createElement(MapaPage));
    rerender(React.createElement(MapaPage));
    expect(screen.getByRole("button", { name: /✓ Fileira A pulou um número/ })).toBeTruthy();
    expect(chamadasEm("GET", "/mapas/m1/revisao")).toHaveLength(1);
  });
});
