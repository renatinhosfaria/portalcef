// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PedidoComIngressos } from "@essencia/shared/types";
import { compartilharCortesiasAgrupadas, compartilharVoucher, nomeArquivoCortesias } from "./baixar-voucher";
import { obterVoucher } from "./api-cortesias";
import { gerarPdfIngressos, gerarPdfLoteIngressos, nomeArquivoIngresso } from "@essencia/components/eventos/pdf-ingresso";

vi.mock("./api-cortesias", () => ({ obterVoucher: vi.fn() }));
vi.mock("@essencia/components/eventos/pdf-ingresso", async (importOriginal) => ({ ...await importOriginal<typeof import("@essencia/components/eventos/pdf-ingresso")>(), gerarPdfIngressos: vi.fn(), gerarPdfLoteIngressos: vi.fn(), nomeArquivoIngresso: vi.fn(() => "ingresso-ORD-1-00000001.pdf") }));
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ""; });

beforeEach(() => {
  vi.stubGlobal("navigator", { canShare: () => true, share: vi.fn().mockResolvedValue(undefined) });
});
afterEach(() => vi.unstubAllGlobals());

const pedido = { orderNumber: "ORD-1", tickets: [{ numero: "00000001" }], event: { imageUrl: "https://exemplo.test/arte.jpg" } } as unknown as PedidoComIngressos;
const cortesia = { orderId: "pedido-1", numero: "00000001" } as never;

describe("compartilharVoucher", () => {
  it("busca o voucher, gera PDF com arte administrativa e compartilha o arquivo", async () => {
    vi.mocked(obterVoucher).mockResolvedValue(pedido);
    vi.mocked(gerarPdfIngressos).mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    const click = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => tag === "a" ? Object.assign(originalCreate("a"), { click }) : originalCreate(tag)) as typeof document.createElement);
    await compartilharVoucher("ev-1", cortesia);
    expect(obterVoucher).toHaveBeenCalledWith("ev-1", "pedido-1");
    expect(gerarPdfIngressos).toHaveBeenCalledWith(pedido, pedido.tickets, expect.objectContaining({ carregarArte: expect.any(Function), variante: "CORTESIA" }));
    expect(nomeArquivoIngresso).toHaveBeenCalledWith(pedido, pedido.tickets[0]);
    expect(navigator.share).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: "ingresso-ORD-1-00000001.pdf", type: "application/pdf" })] });
    expect(click).not.toHaveBeenCalled();
  });

  it("junta as cortesias escolhidas num único PDF, na ordem recebida", async () => {
    const pedidoA = { ...pedido, orderNumber: "ORD-A", tickets: [{ numero: "A" }] } as unknown as PedidoComIngressos;
    const pedidoB = { ...pedido, orderNumber: "ORD-B", tickets: [{ numero: "B" }] } as unknown as PedidoComIngressos;
    vi.mocked(obterVoucher).mockImplementation(async (_evento, orderId) => (orderId === "pedido-a" ? pedidoA : pedidoB));
    vi.mocked(gerarPdfLoteIngressos).mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    let nomeBaixado = "";
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag !== "a") return originalCreate(tag);
      const link = originalCreate("a");
      return Object.assign(link, { click: () => { nomeBaixado = link.download; } });
    }) as typeof document.createElement);
    const cortesias = [{ orderId: "pedido-a", grupo: "Professores" }, { orderId: "pedido-b", grupo: "Professores" }] as never[];
    await compartilharCortesiasAgrupadas("ev-1", cortesias);
    expect(obterVoucher).toHaveBeenCalledWith("ev-1", "pedido-a");
    expect(obterVoucher).toHaveBeenCalledWith("ev-1", "pedido-b");
    expect(gerarPdfLoteIngressos).toHaveBeenCalledWith(
      [{ pedido: pedidoA, ingressos: pedidoA.tickets }, { pedido: pedidoB, ingressos: pedidoB.tickets }],
      expect.objectContaining({ carregarArte: expect.any(Function), variante: "CORTESIA" }),
    );
    expect(navigator.share).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: "cortesias-professores-2.pdf", type: "application/pdf" })] });
    expect(nomeBaixado).toBe("");
  });

  it("nomeia o arquivo pelo grupo comum ou de forma genérica", () => {
    expect(nomeArquivoCortesias([{ grupo: "Família Ângela" }, { grupo: "família ângela" }] as never[])).toBe("cortesias-familia-angela-2.pdf");
    expect(nomeArquivoCortesias([{ grupo: "A" }, { grupo: "B" }, { grupo: "B" }] as never[])).toBe("cortesias-3.pdf");
  });
});
