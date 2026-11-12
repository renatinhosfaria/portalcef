import { afterEach, describe, expect, it, vi } from "vitest";
import type { CortesiaResumo, MapaAdminSessao, PedidoComIngressos } from "@essencia/shared/types";
import { ErroApiMapa } from "../conferencia/api-mapas";
import { cancelarCortesia, conflitosDoErro, emitirCortesias, listarCortesias, obterMapaAdmin, obterVoucher } from "./api-cortesias";

const cortesia = { orderId: "pedido-1" } as CortesiaResumo;
const mapa = { sessionId: "sessao-1", mapId: "mapa-1", seats: [], inventarioPorAssento: {} } as MapaAdminSessao;
const pedido = { orderNumber: "ABC123" } as PedidoComIngressos;

afterEach(() => vi.unstubAllGlobals());

describe("api-cortesias", () => {
  it("usa credenciais e as rotas administrativas corretas", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await listarCortesias("ev-1");
    await obterMapaAdmin("ev-1", "sessao-1");
    await emitirCortesias("ev-1", { sessionId: "sessao-1", chave: "chave-123", grupo: "Pais", motivo: "Convidados", assentos: [] });
    await obterVoucher("ev-1", "pedido-1");
    await cancelarCortesia("ev-1", "pedido-1", "erro");

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method, init?.credentials])).toEqual([
      ["/eventos-admin/api/eventos/admin/ev-1/cortesias", undefined, "include"],
      ["/eventos-admin/api/eventos/admin/ev-1/sessoes/sessao-1/mapa-admin", undefined, "include"],
      ["/eventos-admin/api/eventos/admin/ev-1/cortesias", "POST", "include"],
      ["/eventos-admin/api/eventos/admin/ev-1/cortesias/pedido-1/voucher", undefined, "include"],
      ["/eventos-admin/api/eventos/admin/ev-1/cortesias/pedido-1/cancelar", "POST", "include"],
    ]);
  });

  it("envia JSON para emitir e cancelar", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ data: cortesia })));
    vi.stubGlobal("fetch", fetchMock);

    await emitirCortesias("ev-1", { sessionId: "sessao-1", chave: "chave-123", grupo: "Pais", motivo: "Convidados", assentos: [{ inventorySeatId: "inv-1", nome: "Maria" }] });
    await cancelarCortesia("ev-1", "pedido-1", "erro de digitação");

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ body: JSON.stringify({ sessionId: "sessao-1", chave: "chave-123", grupo: "Pais", motivo: "Convidados", assentos: [{ inventorySeatId: "inv-1", nome: "Maria" }] }) });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ body: JSON.stringify({ motivo: "erro de digitação" }) });
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("content-type")).toBe("application/json");
  });

  it("extrai os conflitos do erro de assentos indisponíveis", () => {
    const erro = new ErroApiMapa("ocupados");
    erro.code = "ASSENTOS_INDISPONIVEIS";
    erro.details = { conflitos: [{ inventorySeatId: "inv-1", rowLabel: "B", seatNumber: "4", motivo: "VENDIDO" }] };
    expect(conflitosDoErro(erro)).toEqual(erro.details.conflitos);
    expect(conflitosDoErro(new Error("falha"))).toEqual([]);
    expect(conflitosDoErro({ code: "ASSENTOS_INDISPONIVEIS", details: { conflitos: [] } })).toEqual([]);
  });

  it("retorna os dados das rotas", async () => {
    const fetchMock = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [cortesia] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: mapa })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [cortesia] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: pedido })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: cortesia })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listarCortesias("ev-1")).resolves.toEqual([cortesia]);
    await expect(obterMapaAdmin("ev-1", "sessao-1")).resolves.toEqual(mapa);
    await expect(emitirCortesias("ev-1", { sessionId: "sessao-1", chave: "chave-123", grupo: "Pais", motivo: "Convidados", assentos: [] })).resolves.toEqual([cortesia]);
    await expect(obterVoucher("ev-1", "pedido-1")).resolves.toEqual(pedido);
    await expect(cancelarCortesia("ev-1", "pedido-1", "erro")).resolves.toEqual(cortesia);
  });
});
