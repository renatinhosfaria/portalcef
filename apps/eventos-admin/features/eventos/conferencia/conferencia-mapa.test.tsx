// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aplicarOperacoes, type OperacaoProposta, type PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./planta-pdf", () => ({
  PlantaPdf: () => <div data-testid="planta-pdf" />,
}));

import { ConferenciaMapa } from "./conferencia-mapa";

function lugar(id: string, fileira: string, numero: string, x: number, cor: string) {
  return {
    id, fileira, numero, x, y: 1000, largura: 200, altura: 200, rotacao: 0, blocoId: null, cor,
    categoriaManual: null, acessoExternoManual: null, vender: true, origem: "GERADOR" as const,
  };
}

function propostaComPendencias(): PropostaMapa {
  return {
    versao: 1,
    revisao: 3,
    pagina: { numero: 1, largura: 8420, altura: 5950 },
    lugares: [lugar("l1", "A", "1", 1000, "#c1"), lugar("l2", "A", "2", 1300, "#c1"), lugar("l3", "B", "1", 1000, "#c2")],
    rotulos: [],
    elementos: [],
    legenda: [
      { cor: "#c1", texto: "Comum", quantidade: 99, categoria: "COMUM", acessoExterno: false, confirmada: true },
      { cor: "#c2", texto: null, quantidade: 99, categoria: null, acessoExterno: false, confirmada: false },
    ],
    pontos: [{ id: "p1", tipo: "SALTO_NUMERACAO", mensagem: "Fileira A pulou um número", lugarIds: ["l1", "l2"], conferido: false }],
  };
}

function propostaLimpa(): PropostaMapa {
  const base = propostaComPendencias();
  return {
    ...base,
    legenda: base.legenda.map((e) => ({ ...e, categoria: e.categoria ?? "COMUM", confirmada: true })),
    pontos: base.pontos.map((p) => ({ ...p, conferido: true })),
  };
}

let servidor: PropostaMapa;
let fetchMock: ReturnType<typeof vi.fn>;

function operacoesEnviadas(i = 0): OperacaoProposta[] {
  const init = (fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1];
  return JSON.parse(init.body as string).operacoes;
}

function renderizar(inicial: PropostaMapa, extras: Partial<React.ComponentProps<typeof ConferenciaMapa>> = {}) {
  servidor = inicial;
  const props = {
    eventoId: "ev1",
    mapId: "m1",
    propostaInicial: inicial,
    onPublicar: vi.fn(async () => {}),
    onReenviar: vi.fn(async () => {}),
    ...extras,
  };
  return { ...render(<ConferenciaMapa {...props} />), props };
}

beforeEach(() => {
  fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const { operacoes } = JSON.parse(init.body as string);
    servidor = aplicarOperacoes(servidor, operacoes);
    return new Response(JSON.stringify({ success: true, data: servidor }));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ConferenciaMapa", () => {
  it("mostra etapas e o resumo da proposta", () => {
    renderizar(propostaComPendencias());

    expect(screen.getByText("Enviar planta")).toBeTruthy();
    expect(screen.getByText("Conferir").closest("[aria-current='step']")).not.toBeNull();
    expect(screen.getByText("Publicar", { selector: "li *" })).toBeTruthy();
    expect(screen.getByText("fileiras").previousElementSibling?.textContent).toBe("2");
    expect(screen.getByText("lugares").previousElementSibling?.textContent).toBe("3");
    expect(screen.getByText("não vender").previousElementSibling?.textContent).toBe("0");
  });

  it("clicar num ponto seleciona os lugares e marcar como conferido envia CONFERIR_PONTO", async () => {
    const user = userEvent.setup();
    renderizar(propostaComPendencias());

    await user.click(screen.getByRole("button", { name: /Fileira A pulou um número/ }));
    expect(screen.getByText("2 lugares selecionados")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Marcar como conferido" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(operacoesEnviadas()).toEqual([{ tipo: "CONFERIR_PONTO", pontoId: "p1" }]);
  });

  it("editar número, não vender e excluir enviam as operações do lugar", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderizar(propostaComPendencias());

    fireEvent.click(screen.getByRole("button", { name: "A-1, Comum" }));
    const numero = screen.getByLabelText("Número") as HTMLInputElement;
    expect(numero.value).toBe("1");
    await user.clear(numero);
    await user.type(numero, "7");
    await user.tab();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(operacoesEnviadas(0)).toEqual([{ tipo: "EDITAR_LUGAR", lugarId: "l1", numero: "7" }]);

    await user.click(screen.getByLabelText("Não vender"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(operacoesEnviadas(1)).toEqual([{ tipo: "EDITAR_LUGAR", lugarId: "l1", vender: false }]);

    await user.click(screen.getByRole("button", { name: "Excluir lugar" }));
    expect(globalThis.confirm).toHaveBeenCalled();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(operacoesEnviadas(2)).toEqual([{ tipo: "EXCLUIR_LUGAR", lugarId: "l1" }]);
  });

  it("Enter no campo de fileira envia a edição", async () => {
    const user = userEvent.setup();
    renderizar(propostaComPendencias());

    fireEvent.click(screen.getByRole("button", { name: "A-1, Comum" }));
    const fileira = screen.getByLabelText("Fileira");
    await user.clear(fileira);
    await user.type(fileira, "Z{Enter}");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(operacoesEnviadas()).toEqual([{ tipo: "EDITAR_LUGAR", lugarId: "l1", fileira: "Z" }]);
  });

  it("Shift+clique e troca de categoria enviam uma edição por lugar numa única chamada", async () => {
    const user = userEvent.setup();
    renderizar(propostaComPendencias());

    fireEvent.click(screen.getByRole("button", { name: "A-1, Comum" }));
    fireEvent.click(screen.getByRole("button", { name: "A-2, Comum" }), { shiftKey: true });
    expect(screen.getByText("2 lugares selecionados")).toBeTruthy();

    await user.selectOptions(screen.getByLabelText("Categoria"), "OBESO");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(operacoesEnviadas()).toEqual([
      { tipo: "EDITAR_LUGAR", lugarId: "l1", categoria: "OBESO" },
      { tipo: "EDITAR_LUGAR", lugarId: "l2", categoria: "OBESO" },
    ]);
  });

  it("confirmar a cor envia CONFIRMAR_LEGENDA e a contagem vem dos lugares atuais", async () => {
    const user = userEvent.setup();
    renderizar(propostaComPendencias());

    const item = screen.getByRole("listitem", { name: "Cor #c2" });
    expect(within(item).getByText("Sem legenda na planta")).toBeTruthy();
    expect(within(item).getByText("1 lugar")).toBeTruthy();
    expect(within(screen.getByRole("listitem", { name: "Cor #c1" })).getByText("2 lugares")).toBeTruthy();

    await user.selectOptions(within(item).getByLabelText("Categoria da cor #c2"), "CADEIRANTE");
    await user.click(within(item).getByLabelText("Acesso externo da cor #c2"));
    await user.click(within(item).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(operacoesEnviadas()).toEqual([
      { tipo: "CONFIRMAR_LEGENDA", cor: "#c2", categoria: "CADEIRANTE", acessoExterno: true },
    ]);
  });

  it("adicionar lugar no modo Sobrepor envia ADICIONAR_LUGAR com as coordenadas do clique", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("crypto", { randomUUID: () => "novo-id" });
    const { container } = renderizar(propostaComPendencias());

    expect(screen.queryByRole("button", { name: "Adicionar lugar" })).toBeNull();
    expect(container.querySelector("foreignObject [data-testid='planta-pdf']")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sobrepor" }));
    expect(container.querySelector("foreignObject [data-testid='planta-pdf']")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Adicionar lugar" }));
    const svg = container.querySelector("svg")!;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 842, height: 595, right: 842, bottom: 595, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.click(container.querySelector("[data-fundo-clique]")!, { clientX: 421, clientY: 297.5 });

    const formulario = screen.getByRole("form", { name: "Novo lugar" });
    await user.type(within(formulario).getByLabelText("Fileira do novo lugar"), "Z");
    await user.type(within(formulario).getByLabelText("Número do novo lugar"), "9");
    await user.click(within(formulario).getByRole("button", { name: "Adicionar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(operacoesEnviadas()).toEqual([
      { tipo: "ADICIONAR_LUGAR", lugar: { id: "novo-id", fileira: "Z", numero: "9", x: 4210, y: 2975 } },
    ]);
  });

  it("Publicar fica desabilitado com pendências e lista o que falta", () => {
    renderizar(propostaComPendencias());

    expect((screen.getByRole("button", { name: "Publicar mapa" }) as HTMLButtonElement).disabled).toBe(true);
    const pendencias = screen.getByRole("list", { name: "Pendências para publicar" });
    expect(within(pendencias).getByText("Fileira A pulou um número")).toBeTruthy();
    expect(within(pendencias).getByText("Confirme o significado da cor #c2")).toBeTruthy();
  });

  it("Publicar liberado envia o motivo opcional, uma única vez", async () => {
    const user = userEvent.setup();
    let liberar: () => void = () => {};
    const onPublicar = vi.fn(() => new Promise<void>((resolve) => { liberar = resolve; }));
    renderizar(propostaLimpa(), { onPublicar });

    await user.click(screen.getByRole("button", { name: "Publicar mapa" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Motivo das correções (opcional)"), "ajuste da fileira A");
    const confirmar = within(dialogo).getByRole("button", { name: "Confirmar publicação" }) as HTMLButtonElement;
    await user.click(confirmar);
    await user.click(confirmar);

    expect(onPublicar).toHaveBeenCalledTimes(1);
    expect(onPublicar).toHaveBeenCalledWith(3, "ajuste da fileira A");
    expect(confirmar.disabled).toBe(true);
    liberar();
  });

  it("sem motivo, publica com motivo indefinido", async () => {
    const user = userEvent.setup();
    const { props } = renderizar(propostaLimpa());

    await user.click(screen.getByRole("button", { name: "Publicar mapa" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar publicação" }));
    expect(props.onPublicar).toHaveBeenCalledWith(3, undefined);
  });

  it("Enviar outra planta pede confirmação antes de aceitar o arquivo", async () => {
    const user = userEvent.setup();
    const confirmar = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmar);
    const cliqueNoArquivo = vi.spyOn(HTMLInputElement.prototype, "click");
    const { props } = renderizar(propostaLimpa());

    await user.click(screen.getByRole("button", { name: "Enviar outra planta" }));
    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining("A conferência atual será descartada"));
    expect(cliqueNoArquivo).not.toHaveBeenCalled();

    confirmar.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Enviar outra planta" }));
    expect(cliqueNoArquivo).toHaveBeenCalledTimes(1);

    const arquivo = new File(["%PDF"], "nova.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Arquivo da nova planta"), { target: { files: [arquivo] } });
    await waitFor(() => expect(props.onReenviar).toHaveBeenCalledWith(arquivo));
  });
  it("mostra o erro quando o reenvio falha e trava repetição enquanto envia", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    let falhar: (e: Error) => void = () => {};
    const onReenviar = vi.fn(() => new Promise<void>((_, rejeitar) => { falhar = rejeitar; }));
    renderizar(propostaLimpa(), { onReenviar });
    const entrada = screen.getByLabelText("Arquivo da nova planta") as HTMLInputElement;
    const arquivo = new File(["%PDF"], "nova.pdf", { type: "application/pdf" });

    fireEvent.change(entrada, { target: { files: [arquivo] } });
    fireEvent.change(entrada, { target: { files: [arquivo] } });
    expect(onReenviar).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Enviar outra planta" }) as HTMLButtonElement).disabled).toBe(true);
    expect(entrada.disabled).toBe(true);

    falhar(new Error("PDF inválido"));
    expect((await screen.findByRole("alert")).textContent).toContain("PDF inválido");
    expect((screen.getByRole("button", { name: "Enviar outra planta" }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole("button", { name: "Enviar outra planta" }));
  });
});
