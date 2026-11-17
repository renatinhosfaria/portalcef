// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PedidoComIngressos } from "@essencia/shared/types";
import { jsPDF } from "jspdf";
import { compartilharOuBaixar, gerarPdfIngressos, gerarPdfLoteIngressos, medirCartao, nomeArquivoIngresso } from "./pdf-ingresso";

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
  event: { title: "Festival da Família", slug: "festival-da-familia", imageUrl: "https://cdn.example/arte.jpg", locationName: "Teatro Essência", classificacaoEtaria: null },
  tickets: [
    { numero: "K7Q482MX", qrPayload: "qr-1", rowLabel: "B", seatNumber: "12", ticketTypeName: "Inteira", participantName: "Beatriz Souza", status: "ATIVO", priceCents: 4500 },
    { numero: "2MN9PQRS", qrPayload: "qr-2", rowLabel: "B", seatNumber: "13", ticketTypeName: "Meia", participantName: "Caio Souza", status: "ATIVO", priceCents: 2250 },
  ],
};

function lerTexto(blob: Blob): Promise<string> {
  return new Promise<string>((resolve) => { const leitor = new FileReader(); leitor.onload = () => resolve(String(leitor.result)); leitor.readAsText(blob); });
}

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

  it("segue o visual do cartão da tela: quadros de fileira/assento/tipo e instrução uma única vez", async () => {
    const blob = await gerarPdfIngressos(pedido, [pedido.tickets[0]!], { carregarArte: async () => null });
    const texto = await lerTexto(blob);
    expect(texto).toContain("(FILEIRA)");
    expect(texto).toContain("(ASSENTO)");
    expect(texto).toContain("(INGRESSO)");
    expect(texto.match(/Na entrada, mostre o QR code/g)?.length).toBe(1);
    expect(texto.match(/K7Q4-82MX/g)?.length).toBe(1);
    expect(texto).not.toContain("CORTESIA");
  });

  it("marca a cortesia com um selo no topo", async () => {
    const blob = await gerarPdfIngressos(pedido, [pedido.tickets[0]!], { carregarArte: async () => null, variante: "CORTESIA" });
    expect(await lerTexto(blob)).toContain("(CORTESIA)");
  });

  it("traz o valor pago, os avisos de acesso e a classificação indicativa", async () => {
    const comClassificacao: PedidoComIngressos = { ...pedido, event: { ...pedido.event, classificacaoEtaria: "LIVRE" } };
    const texto = await lerTexto(await gerarPdfIngressos(comClassificacao, [pedido.tickets[0]!], { carregarArte: async () => null }));
    expect(texto).toContain("(Valor do ingresso)");
    expect(texto).toContain("(R$ 45,00)");
    expect(texto).toContain("A abertura da plateia");
    expect(texto).toContain("permitida a entrada");
    expect(texto).toContain("(L)");
    expect(texto).toContain("Livre para todos os p");
  });

  it("descreve a faixa etária a partir da classificação do evento", async () => {
    const dozeAnos: PedidoComIngressos = { ...pedido, event: { ...pedido.event, classificacaoEtaria: "12" } };
    const texto = await lerTexto(await gerarPdfIngressos(dozeAnos, [pedido.tickets[1]!], { carregarArte: async () => null }));
    expect(texto).toContain("recomendado para menores de 12 anos");
    expect(texto).toContain("(R$ 22,50)");
  });

  it("omite a classificação quando o evento ainda não a informou", async () => {
    const texto = await lerTexto(await gerarPdfIngressos(pedido, [pedido.tickets[0]!], { carregarArte: async () => null }));
    expect(texto).not.toContain("recomendado para menores");
    expect(texto).not.toContain("Livre para todos");
  });

  it("identifica o valor da cortesia", async () => {
    const cortesia: PedidoComIngressos = { ...pedido, tickets: [{ ...pedido.tickets[0]!, ticketTypeName: "Cortesia", priceCents: 0 }] };
    const texto = await lerTexto(await gerarPdfIngressos(cortesia, cortesia.tickets, { carregarArte: async () => null, variante: "CORTESIA" }));
    expect(texto).toContain("(R$ 0,00 \\(cortesia\\))");
  });

  it("mantém o QR no tamanho original no ingresso comum e cabe na folha A5", () => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
    const medidas = medirCartao(pdf, { pedido: { ...pedido, event: { ...pedido.event, classificacaoEtaria: "LIVRE" } }, ingresso: pedido.tickets[0]!, variante: "INGRESSO" });
    expect(medidas.tamanhoQr).toBe(52);
    expect(medidas.topo + medidas.alturaCartao).toBeLessThanOrEqual(200.01);
  });

  it("cabe na folha A5 no pior caso, reduzindo só o QR até um tamanho seguro", () => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
    const longo: PedidoComIngressos = {
      ...pedido,
      event: { ...pedido.event, title: "Espetáculo de Ballet 2026 — O Chamado do Oceano e as Sereias do Mar Profundo", locationName: "Teatro Municipal de Uberlândia — Av. Rondon Pacheco, 7070, Tibery, Uberlândia - MG", classificacaoEtaria: "12" },
    };
    const medidas = medirCartao(pdf, { pedido: longo, ingresso: { ...pedido.tickets[0]!, ticketTypeName: "Combo 10 ingressos", participantName: "Maria Eduarda de Oliveira Albuquerque Cavalcanti" }, variante: "CORTESIA" });
    expect(medidas.topo + medidas.alturaCartao).toBeLessThanOrEqual(200.01);
    expect(medidas.tamanhoQr).toBeGreaterThanOrEqual(40);
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

