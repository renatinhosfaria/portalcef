// @vitest-environment jsdom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PedidoPublicoResult, PoliticaPublica, PublicEventDetail, PublicEventSession } from "@essencia/shared/types";
import { EventosApiError } from "../../lib/eventos-api";
import * as eventosApi from "../../lib/eventos-api";
import { FluxoCheckout } from "../checkout/fluxo-checkout";
import { formatarTempoRestante, RelogioReserva } from "../checkout/relogio-reserva";

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock("../../lib/eventos-api", async () => {
  const atual = await vi.importActual<typeof import("../../lib/eventos-api")>("../../lib/eventos-api");
  return { ...atual, finalizarPedido: vi.fn(), iniciarPagamento: vi.fn(), liberarPedido: vi.fn() };
});
vi.mock("../checkout/pagamento-embutido", () => ({ PagamentoEmbutido: ({ clientSecret }: { clientSecret: string }) => <div data-testid="pagamento-embutido">{clientSecret}</div> }));

const politicas: PoliticaPublica[] = [
  ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"].map((type, index) => ({ type: type as PoliticaPublica["type"], version: index + 1, content: `Texto da política ${type}` })),
].flat();
const sessao: PublicEventSession = { id: "sessao-1", startsAt: new Date("2026-12-07T19:00:00Z"), endsAt: new Date("2026-12-07T21:00:00Z"), status: "PUBLICADA", capacity: 30, location: { name: "Auditório", address: "Rua A", room: null, instructions: null, accessibility: null }, mapId: "mapa-1", salesStartsAt: null, salesEndsAt: null, availability: "available", offers: [], ticketTypes: [{ id: "inteira", name: "Inteira", description: null, priceCents: 5000, maxPerOrder: null, eligibility: null }, { id: "meia", name: "Meia-entrada", description: null, priceCents: 2500, maxPerOrder: null, eligibility: "Estudantes" }] };
const evento: PublicEventDetail = { id: "evento-1", slug: "festival", title: "Festival da Família", summary: "Resumo", description: "Descrição", imageUrl: "https://example.com/arte.jpg", category: "Música", startsAt: sessao.startsAt, locationName: "Auditório", fromPriceCents: 2500, availability: "available", contactEmail: null, contactPhone: null, cancellationPolicy: null };
const pedido: PedidoPublicoResult = { orderNumber: "PED123456", status: "RESERVADO", eventTitle: evento.title, eventSlug: evento.slug, sessionId: sessao.id, expiresAt: new Date("2026-12-07T18:30:00Z"), session: { startsAt: sessao.startsAt, endsAt: sessao.endsAt }, subtotalCents: 7500, discountCents: 500, totalCents: 7000, appliedOffer: { id: "oferta", version: 1, name: "Grupo", minQuantity: 3, maxQuantity: null, discountPercent: 7 }, items: [
  { seatId: "seat-19", ticketTypeId: "inteira", unitPriceCents: 5000, totalPriceCents: 5000, rowLabel: "G", seatNumber: "19", ticketTypeName: "Inteira" },
  { seatId: "seat-20", ticketTypeId: "meia", unitPriceCents: 2500, totalPriceCents: 2500, rowLabel: "G", seatNumber: "20", ticketTypeName: "Meia-entrada" },
] };

afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); });

describe("relógio de reserva", () => {
  it("formata o tempo restante e zera valores negativos", () => {
    expect(formatarTempoRestante(14 * 60_000 + 32_000)).toBe("14:32");
    expect(formatarTempoRestante(-1)).toBe("00:00");
  });

  it("chama onEsgotar uma vez ao chegar a zero", () => {
    vi.useFakeTimers();
    let agora = new Date("2026-12-07T18:00:00Z").getTime();
    const onEsgotar = vi.fn();
    const { rerender } = render(<RelogioReserva expiraEm={new Date(agora + 1000)} agora={() => agora} onEsgotar={onEsgotar} />);
    agora += 1000;
    rerender(<RelogioReserva expiraEm={new Date(agora - 1)} agora={() => agora} onEsgotar={onEsgotar} />);
    vi.advanceTimersByTime(1000);
    expect(onEsgotar).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("FluxoCheckout", () => {
  beforeEach(() => {
    vi.mocked(eventosApi.finalizarPedido).mockResolvedValue({ pedido, acesso: "acesso-seguro" });
    vi.mocked(eventosApi.iniciarPagamento).mockResolvedValue({ clientSecret: "cs_test", expiresAt: pedido.expiresAt!, orderNumber: pedido.orderNumber });
    vi.mocked(eventosApi.liberarPedido).mockResolvedValue(undefined);
  });

  it("lista o que falta antes de enviar", () => {
    render(<FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey="pk_test" />);
    fireEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }));
    expect(screen.getByRole("alert").textContent).toContain("Falta:");
    expect(eventosApi.finalizarPedido).not.toHaveBeenCalled();
  });

  it("envia comprador, participantes e cinco aceites, guarda acesso e inicia pagamento", async () => {
    render(<FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey="pk_test" />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana Silva" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Celular (WhatsApp)"), { target: { value: "34999999999" } });
    fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G19"), { target: { value: "Ana Silva" } });
    fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G20"), { target: { value: "Bia Silva" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Li e aceito as políticas do evento" }));
    fireEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }));

    await waitFor(() => expect(eventosApi.iniciarPagamento).toHaveBeenCalled());
    expect(eventosApi.finalizarPedido).toHaveBeenCalledWith(pedido.orderNumber, expect.objectContaining({
      buyer: { name: "Ana Silva", email: "ana@example.com", phone: "34999999999" },
      participants: [{ participantIndex: 0, fullName: "Ana Silva", type: "CONVIDADO" }, { participantIndex: 1, fullName: "Bia Silva", type: "CONVIDADO" }],
      acceptances: politicas.map(({ type, version }) => ({ type, version })),
    }));
    const returnUrl = vi.mocked(eventosApi.iniciarPagamento).mock.calls[0]?.[1].returnUrl;
    expect(returnUrl).toContain("acesso-seguro");
    expect(sessionStorage.getItem(`eventos:acesso:${pedido.orderNumber}`)).toBe("acesso-seguro");
    expect(screen.getByTestId("pagamento-embutido").textContent).toContain("cs_test");
    expect(screen.getByText(/Pagamento/)).toBeTruthy();
  });

  function preencherObrigatorios() {
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana Silva" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Celular (WhatsApp)"), { target: { value: "34999999999" } });
    fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G19"), { target: { value: "Ana Silva" } });
    fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G20"), { target: { value: "Bia Silva" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Li e aceito as políticas do evento" }));
  }

  it("a aluna que convidou é opcional e não entra no envio quando fica em branco", async () => {
    render(<FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey="pk_test" />);
    expect((screen.getByLabelText("Aluna que convidou, lugar G19 (opcional)") as HTMLInputElement).required).toBe(false);
    preencherObrigatorios();
    fireEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }));

    await waitFor(() => expect(eventosApi.finalizarPedido).toHaveBeenCalled());
    const enviados = vi.mocked(eventosApi.finalizarPedido).mock.calls[0]![1].participants;
    expect(enviados.every((participante) => !("studentName" in participante))).toBe(true);
  });

  it("sugere a aluna do primeiro lugar nos seguintes e envia a de cada ingresso", async () => {
    render(<FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey="pk_test" />);
    preencherObrigatorios();
    const primeira = screen.getByLabelText("Aluna que convidou, lugar G19 (opcional)") as HTMLInputElement;
    const segunda = screen.getByLabelText("Aluna que convidou, lugar G20 (opcional)") as HTMLInputElement;

    fireEvent.change(primeira, { target: { value: "  Beatriz Santos " } });
    expect(segunda.value).toBe("  Beatriz Santos ");

    fireEvent.change(segunda, { target: { value: "Carla Lima" } });
    fireEvent.change(primeira, { target: { value: "Beatriz Santos" } });
    expect(segunda.value).toBe("Carla Lima");

    fireEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }));
    await waitFor(() => expect(eventosApi.finalizarPedido).toHaveBeenCalled());
    expect(vi.mocked(eventosApi.finalizarPedido).mock.calls[0]![1].participants).toEqual([
      { participantIndex: 0, fullName: "Ana Silva", type: "CONVIDADO", studentName: "Beatriz Santos" },
      { participantIndex: 1, fullName: "Bia Silva", type: "CONVIDADO", studentName: "Carla Lima" },
    ]);
  });

  it("não mostra nomes internos de política nem promete e-mail", () => {
    render(<FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey={null} />);
    expect(screen.getByText("Cancelamento e reembolso")).toBeTruthy();
    expect(screen.getByText("Compra e meia-entrada")).toBeTruthy();
    expect(screen.queryByText("CANCELAMENTO_REEMBOLSO")).toBeNull();
    expect(screen.queryByText(/e-mail de confirmação/i)).toBeNull();
  });

  it("alterar lugares libera e volta ao mapa com a seleção", async () => {
    render(<FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey={null} />);
    fireEvent.click(screen.getByRole("link", { name: "Alterar lugares" }));
    await waitFor(() => expect(eventosApi.liberarPedido).toHaveBeenCalledWith(pedido.orderNumber));
    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining("assentos=seat-19%2Cseat-20"));
  });

  it("pagamento já concluído leva aos ingressos", async () => {
    vi.mocked(eventosApi.liberarPedido).mockRejectedValue(new EventosApiError("Pagamento já concluído", 409, "PAYMENT_ALREADY_COMPLETED"));
    sessionStorage.setItem(`eventos:acesso:${pedido.orderNumber}`, "acesso-seguro");
    render(<FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey={null} />);
    fireEvent.click(screen.getByRole("link", { name: "Alterar lugares" }));
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith(`/pedido/${pedido.orderNumber}?acesso=acesso-seguro`));
  });

  it("tempo esgotado troca a tela, libera e não envia", async () => {
    const expirado = { ...pedido, expiresAt: new Date(Date.now() - 1000) };
    render(<FluxoCheckout pedido={expirado} evento={evento} sessao={sessao} politicas={politicas} publishableKey={null} />);
    expect(screen.getByText("O tempo acabou e os lugares foram liberados")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Escolher lugares de novo" }).getAttribute("href")).toContain("conflito=disponibilidade");
    expect(screen.queryByRole("button", { name: "Ir para o pagamento" })).toBeNull();
    await waitFor(() => expect(eventosApi.liberarPedido).toHaveBeenCalledTimes(1));
  });

  it("não libera pedido encerrado mesmo com expiração no passado", async () => {
    const encerrado = { ...pedido, status: "CONFIRMADO" as const, expiresAt: null };
    render(<FluxoCheckout pedido={encerrado} evento={evento} sessao={sessao} politicas={politicas} publishableKey={null} />);
    expect(screen.getByText("Este pedido não está mais disponível para pagamento.")).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(eventosApi.liberarPedido).not.toHaveBeenCalled();
  });

  it("libera antes de decidir o destino quando iniciar pagamento retorna ORDER_NOT_AVAILABLE", async () => {
    vi.mocked(eventosApi.iniciarPagamento).mockRejectedValueOnce(new EventosApiError("Pedido indisponível", 409, "ORDER_NOT_AVAILABLE"));
    render(<FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey="pk_test" />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana Silva" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Celular (WhatsApp)"), { target: { value: "34999999999" } });
    fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G19"), { target: { value: "Ana Silva" } });
    fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G20"), { target: { value: "Bia Silva" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Li e aceito as políticas do evento" }));
    fireEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }));
    await waitFor(() => expect(eventosApi.liberarPedido).toHaveBeenCalledTimes(1));
    expect(routerPush).not.toHaveBeenCalledWith(`/pedido/${pedido.orderNumber}?acesso=acesso-seguro`);
    expect(screen.getByText("O tempo acabou e os lugares foram liberados")).toBeTruthy();
  });

  it("libera o pedido uma vez quando o relógio zera", async () => {
    vi.useFakeTimers();
    try {
      const agora = Date.now();
      vi.setSystemTime(agora);
      render(<FluxoCheckout pedido={{ ...pedido, expiresAt: new Date(agora + 1000) }} evento={evento} sessao={sessao} politicas={politicas} publishableKey={null} />);
      vi.advanceTimersByTime(1100);
      await Promise.resolve();
      expect(eventosApi.liberarPedido).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(3000);
      expect(eventosApi.liberarPedido).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it("reutiliza a chave de idempotência ao repetir uma tentativa", async () => {
    vi.mocked(eventosApi.finalizarPedido)
      .mockRejectedValueOnce(new Error("resposta perdida"))
      .mockResolvedValueOnce({ pedido, acesso: "acesso-seguro" });
    render(<FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey="pk_test" />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana Silva" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Celular (WhatsApp)"), { target: { value: "34999999999" } });
    fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G19"), { target: { value: "Ana Silva" } });
    fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G20"), { target: { value: "Bia Silva" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Li e aceito as políticas do evento" }));
    const enviar = screen.getByRole("button", { name: "Ir para o pagamento" });
    fireEvent.click(enviar);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("resposta perdida"));
    fireEvent.click(enviar);
    await waitFor(() => expect(eventosApi.iniciarPagamento).toHaveBeenCalled());
    const primeiraChave = vi.mocked(eventosApi.finalizarPedido).mock.calls[0]?.[1].idempotencyKey;
    const segundaChave = vi.mocked(eventosApi.finalizarPedido).mock.calls[1]?.[1].idempotencyKey;
    expect(primeiraChave).toBeTruthy();
    expect(segundaChave).toBe(primeiraChave);
  });

  it("preserva a finalização que resolve depois da expiração e segue para pagamento", async () => {
    vi.useFakeTimers();
    try {
      const agora = Date.now();
      vi.setSystemTime(agora);
      let resolver!: (value: { pedido: PedidoPublicoResult; acesso: string }) => void;
      vi.mocked(eventosApi.finalizarPedido).mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
      render(<FluxoCheckout pedido={{ ...pedido, expiresAt: new Date(agora + 1000) }} evento={evento} sessao={sessao} politicas={politicas} publishableKey="pk_test" />);
      fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana Silva" } });
      fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
      fireEvent.change(screen.getByLabelText("Celular (WhatsApp)"), { target: { value: "34999999999" } });
      fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G19"), { target: { value: "Ana Silva" } });
      fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G20"), { target: { value: "Bia Silva" } });
      fireEvent.click(screen.getByRole("checkbox", { name: "Li e aceito as políticas do evento" }));
      fireEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }));
      vi.advanceTimersByTime(1100);
      await Promise.resolve();
      await act(async () => {
        resolver({ pedido: { ...pedido, expiresAt: new Date(agora + 30 * 60_000) }, acesso: "acesso-tardio" });
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(eventosApi.iniciarPagamento).toHaveBeenCalled();
      expect(sessionStorage.getItem(`eventos:acesso:${pedido.orderNumber}`)).toBe("acesso-tardio");
      expect(screen.getByTestId("pagamento-embutido")).toBeTruthy();
    } finally { vi.useRealTimers(); }
  });

  it("retoma pagamento pendente após recarregar sem finalizar novamente", async () => {
    sessionStorage.setItem(`eventos:acesso:${pedido.orderNumber}`, "acesso-pendente");
    render(<FluxoCheckout pedido={{ ...pedido, status: "AGUARDANDO_PAGAMENTO" }} evento={evento} sessao={sessao} politicas={politicas} publishableKey="pk_test" />);
    await waitFor(() => expect(eventosApi.iniciarPagamento).toHaveBeenCalledWith(pedido.orderNumber, expect.objectContaining({ returnUrl: expect.stringContaining("acesso-pendente") })));
    expect(eventosApi.finalizarPedido).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("pagamento-embutido")).toBeTruthy());
  });

  it("recupera uma finalização RESERVADO sem token salvo e cria novo acesso", async () => {
    render(<FluxoCheckout pedido={pedido} evento={evento} sessao={sessao} politicas={politicas} publishableKey="pk_test" />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana Silva" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Celular (WhatsApp)"), { target: { value: "34999999999" } });
    fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G19"), { target: { value: "Ana Silva" } });
    fireEvent.change(screen.getByLabelText("Nome de quem vai sentar no lugar G20"), { target: { value: "Bia Silva" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Li e aceito as políticas do evento" }));
    fireEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }));

    await waitFor(() => expect(eventosApi.finalizarPedido).toHaveBeenCalled());
    expect(eventosApi.iniciarPagamento).toHaveBeenCalledWith(pedido.orderNumber, expect.objectContaining({ returnUrl: expect.stringContaining("acesso-seguro") }));
    expect(sessionStorage.getItem(`eventos:acesso:${pedido.orderNumber}`)).toBe("acesso-seguro");
  });
});
