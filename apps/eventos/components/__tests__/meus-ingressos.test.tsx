// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventosApiError } from "../../lib/eventos-api";
import * as eventosApi from "../../lib/eventos-api";
import { MeusIngressos } from "../ingressos/meus-ingressos";

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock("../../lib/eventos-api", async () => {
  const atual = await vi.importActual<typeof import("../../lib/eventos-api")>("../../lib/eventos-api");
  return { ...atual, buscarMeusIngressos: vi.fn() };
});

const pedidos = [
  { orderNumber: "ABC123456", eventTitle: "Festival da Família", sessionStartsAt: new Date("2026-12-07T19:00:00.000Z"), acesso: "acesso-1" },
  { orderNumber: "XYZ654321", eventTitle: "Festa de Encerramento", sessionStartsAt: new Date("2026-12-08T19:00:00.000Z"), acesso: "acesso-2" },
];

afterEach(() => cleanup());
beforeEach(() => { vi.clearAllMocks(); vi.mocked(eventosApi.buscarMeusIngressos).mockResolvedValue({ pedidos: [] }); });

describe("Meus ingressos", () => {
  it("busca por número e e-mail e abre o ingresso quando encontra um pedido", async () => {
    vi.mocked(eventosApi.buscarMeusIngressos).mockResolvedValueOnce({ pedidos: [pedidos[0]!] });
    render(<MeusIngressos />);
    fireEvent.change(screen.getByLabelText("Número do pedido"), { target: { value: "ABC123456" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar ingressos" }));
    await waitFor(() => expect(eventosApi.buscarMeusIngressos).toHaveBeenCalledWith({ orderNumber: "ABC123456", email: "ana@example.com" }));
    expect(routerPush).toHaveBeenCalledWith("/pedido/ABC123456?acesso=acesso-1");
  });

  it("busca por e-mail e celular na aba sem número do pedido", async () => {
    vi.mocked(eventosApi.buscarMeusIngressos).mockResolvedValueOnce({ pedidos: [pedidos[0]!] });
    render(<MeusIngressos />);
    fireEvent.click(screen.getByRole("tab", { name: "Não tenho o número" }));
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Celular"), { target: { value: "(34) 99999-9999" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar ingressos" }));
    await waitFor(() => expect(eventosApi.buscarMeusIngressos).toHaveBeenCalledWith({ email: "ana@example.com", phone: "(34) 99999-9999" }));
  });

  it("lista vários pedidos com título, data e link para cada um", async () => {
    vi.mocked(eventosApi.buscarMeusIngressos).mockResolvedValueOnce({ pedidos });
    render(<MeusIngressos />);
    fireEvent.change(screen.getByLabelText("Número do pedido"), { target: { value: "ABC123456" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar ingressos" }));
    await waitFor(() => expect(screen.getByText("Festival da Família")).toBeTruthy());
    expect(screen.getByText("Festa de Encerramento")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Ver ingressos" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Ver ingressos" })[0]?.getAttribute("href")).toBe("/pedido/ABC123456?acesso=acesso-1");
  });

  it("mostra mensagem genérica quando não encontra um pedido", async () => {
    vi.mocked(eventosApi.buscarMeusIngressos).mockRejectedValueOnce(new EventosApiError("detalhe interno", 404));
    render(<MeusIngressos />);
    fireEvent.change(screen.getByLabelText("Número do pedido"), { target: { value: "ABC123456" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar ingressos" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Não encontramos um pedido com esses dados");
    expect(screen.getByRole("alert").textContent).not.toContain("detalhe interno");
  });

  it("mostra mensagem de muitas tentativas", async () => {
    vi.mocked(eventosApi.buscarMeusIngressos).mockRejectedValueOnce(new EventosApiError("muitas", 429));
    render(<MeusIngressos />);
    fireEvent.change(screen.getByLabelText("Número do pedido"), { target: { value: "ABC123456" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar ingressos" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Muitas tentativas. Aguarde um instante e tente de novo.");
  });

  it("preenche o número vindo da URL", () => {
    render(<MeusIngressos numeroInicial="URL987654" />);
    expect((screen.getByLabelText("Número do pedido") as HTMLInputElement).value).toBe("URL987654");
  });
});

it("expõe relação completa entre abas e painéis", () => {
  render(<MeusIngressos />);
  expect(screen.getByRole("tab", { name: "Tenho o número do pedido" }).getAttribute("aria-controls")).toBe("meus-ingressos-painel-numero");
  expect(screen.getByRole("tab", { name: "Não tenho o número" }).getAttribute("aria-controls")).toBe("meus-ingressos-painel-dados");
  expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("meus-ingressos-aba-numero");
});

it("troca de aba com setas mantém seleção e foco", () => {
  render(<MeusIngressos />);
  const numero = screen.getByRole("tab", { name: "Tenho o número do pedido" });
  const dados = screen.getByRole("tab", { name: "Não tenho o número" });
  fireEvent.keyDown(numero, { key: "ArrowRight" });
  expect(dados.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(dados);
  fireEvent.keyDown(dados, { key: "ArrowLeft" });
  expect(numero.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(numero);
});

it("ignora resposta de uma busca que ficou desatualizada ao trocar de aba", async () => {
  let resolver!: (resultado: { pedidos: typeof pedidos }) => void;
  vi.mocked(eventosApi.buscarMeusIngressos).mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
  render(<MeusIngressos />);
  fireEvent.change(screen.getByLabelText("Número do pedido"), { target: { value: "ABC123456" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar ingressos" }));
  fireEvent.click(screen.getByRole("tab", { name: "Não tenho o número" }));
  resolver({ pedidos: [pedidos[0]!] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(routerPush).toHaveBeenCalledTimes(0);
  expect(screen.queryByText("Festival da Família")).toBeNull();
});
