// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PedidoComIngressos } from "@essencia/shared/types";
import { compartilharOuBaixar, gerarPdfIngressos, gerarPdfLoteIngressos, nomeArquivoIngresso } from "./pdf-ingresso";

const pedido: PedidoComIngressos = {
  orderNumber: "G21",
  status: "CONFIRMADO",
  eventTitle: "Festival da Família",
  eventSlug: "festival-da-familia",
  sessionId: "sessao-1",
  expiresAt: null,
  session: { startsAt: new Date("2026-12-07T19:00:00.000Z"), endsAt: new Date("2026-12-07T21:00:00.000Z") },
  subtotalCents: 10000,
  offerDiscountCents: 0,
  couponDiscountCents: 0,
  discountCents: 0,
  totalCents: 10000,
  appliedOffer: null,
  appliedCoupon: null,
  items: [],
  buyerName: "Ana Souza",
  event: { title: "Festival da Família", slug: "festival-da-familia", imageUrl: "https://cdn.example/arte.jpg", locationName: "Teatro Essência" },
  tickets: [
    { numero: "K7Q482MX", qrPayload: "qr-1", rowLabel: "B", seatNumber: "12", ticketTypeName: "Inteira", participantName: "Beatriz Souza", status: "ATIVO" },
    { numero: "2MN9PQRS", qrPayload: "qr-2", rowLabel: "B", seatNumber: "13", ticketTypeName: "Meia", participantName: "Caio Souza", status: "ATIVO" },
  ],
};

describe("PDF dos ingressos", () => {
  it("gera duas páginas e um Blob application/pdf", async () => {
    const blob = await gerarPdfIngressos(pedido, pedido.tickets, { carregarArte: async () => null });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(100);
  });

  it("continua sem arte quando o carregamento da imagem falha", async () => {
    const blob = await gerarPdfIngressos(pedido, [pedido.tickets[0]!], { carregarArte: async () => { throw new Error("falha"); } });
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(100);
  });

  it("junta ingressos de pedidos diferentes num único PDF, uma página por ingresso", async () => {
    const outroPedido: PedidoComIngressos = { ...pedido, orderNumber: "G22", tickets: [{ ...pedido.tickets[0]!, numero: "ZZZZ1111", qrPayload: "qr-3" }] };
    const carregarArte = vi.fn(async () => null);
    const blob = await gerarPdfLoteIngressos([{ pedido, ingressos: pedido.tickets }, { pedido: outroPedido, ingressos: outroPedido.tickets }], { carregarArte, variante: "CORTESIA" });
    expect(blob.type).toBe("application/pdf");
    const texto = await new Promise<string>((resolve) => { const leitor = new FileReader(); leitor.onload = () => resolve(String(leitor.result)); leitor.readAsText(blob); });
    expect(texto.match(/\/Type \/Page\b/g)?.length).toBe(3);
    expect(texto).toContain("G21");
    expect(texto).toContain("G22");
    expect(carregarArte).toHaveBeenCalledTimes(1);
  });

  it("forma o nome de um ingresso ou do conjunto", () => {
    expect(nomeArquivoIngresso(pedido, pedido.tickets[0])).toBe("ingresso-G21-K7Q4-82MX.pdf");
    expect(nomeArquivoIngresso(pedido)).toBe("ingressos-G21.pdf");
  });
});

describe("compartilhamento", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("compartilha quando o navegador aceita arquivos", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const navegador = { canShare: vi.fn().mockReturnValue(true), share };
    const resultado = await compartilharOuBaixar(new File(["pdf"], "ingresso.pdf", { type: "application/pdf" }), navegador);
    expect(resultado).toBe("compartilhado");
    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  it("baixa quando o navegador não aceita arquivos", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const navegador = { canShare: vi.fn().mockReturnValue(false), share: vi.fn() };
    const resultado = await compartilharOuBaixar(new File(["pdf"], "ingresso.pdf", { type: "application/pdf" }), navegador);
    expect(resultado).toBe("baixado");
    expect(click).toHaveBeenCalled();
  });
});

