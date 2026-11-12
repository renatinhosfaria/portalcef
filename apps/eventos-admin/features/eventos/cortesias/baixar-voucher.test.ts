// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PedidoComIngressos } from "@essencia/shared/types";
import { baixarVoucher } from "./baixar-voucher";
import { obterVoucher } from "./api-cortesias";
import { gerarPdfIngressos, nomeArquivoIngresso } from "@essencia/components/eventos/pdf-ingresso";

vi.mock("./api-cortesias", () => ({ obterVoucher: vi.fn() }));
vi.mock("@essencia/components/eventos/pdf-ingresso", () => ({ gerarPdfIngressos: vi.fn(), nomeArquivoIngresso: vi.fn(() => "ingresso-ORD-1-00000001.pdf") }));
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ""; });

const pedido = { orderNumber: "ORD-1", tickets: [{ numero: "00000001" }], event: { imageUrl: "https://exemplo.test/arte.jpg" } } as unknown as PedidoComIngressos;
const cortesia = { orderId: "pedido-1", numero: "00000001" } as never;

describe("baixarVoucher", () => {
  it("busca o voucher, gera PDF com arte administrativa e dispara download", async () => {
    vi.mocked(obterVoucher).mockResolvedValue(pedido);
    vi.mocked(gerarPdfIngressos).mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    const click = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => tag === "a" ? Object.assign(originalCreate("a"), { click }) : originalCreate(tag)) as typeof document.createElement);
    await baixarVoucher("ev-1", cortesia);
    expect(obterVoucher).toHaveBeenCalledWith("ev-1", "pedido-1");
    expect(gerarPdfIngressos).toHaveBeenCalledWith(pedido, pedido.tickets, expect.objectContaining({ carregarArte: expect.any(Function) }));
    expect(nomeArquivoIngresso).toHaveBeenCalledWith(pedido, pedido.tickets[0]);
    expect(click).toHaveBeenCalled();
  });
});
