import { describe, expect, it, vi } from "vitest";
import {
  buscarApiPublica,
  buscarMeusIngressos,
  iniciarPagamento,
  liberarPedido,
  listarEventosPublicos,
  listarPoliticasPublicas,
  listarSessoesPublicas,
  obterEventoPublico,
  obterIngressos,
  obterMapaSessao,
  consultarPedido,
  reservarAssentos,
} from "./eventos-api";

describe("API pública de eventos", () => {
  it("usa /api também quando consulta a API interna no servidor", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("API_INTERNAL_URL", "http://api:3002");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));

    await listarEventosPublicos();

    expect(fetchMock).toHaveBeenCalledWith("http://api:3002/api/eventos/public", expect.objectContaining({ cache: "no-store" }));
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("usa /api no navegador e não encaminha cookie administrativo", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
    await listarEventosPublicos();
    expect(fetchMock).toHaveBeenCalledWith("/api/eventos/public", expect.objectContaining({ cache: "no-store" }));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).not.toBe("include");
    fetchMock.mockRestore();
  });

  it("propaga erro HTTP sem redirecionar", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("falha", { status: 503 }));
    await expect(buscarApiPublica("/eventos/public")).rejects.toThrow("Falha ao consultar API pública (503)");
    vi.restoreAllMocks();
  });

  it("cria chave de idempotência no navegador e preserva a seleção quando a reserva conflita", async () => {
    vi.stubGlobal("window", {});
    const response = new Response(JSON.stringify({ code: "SEAT_UNAVAILABLE", message: "Assento indisponível" }), { status: 409 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const input = { sessionId: "00000000-0000-4000-8000-000000000001", seats: [{ seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 }], buyer: { name: "Ana", email: "ana@example.com", phone: "11999999999" } };
    await expect(reservarAssentos(input)).rejects.toMatchObject({ status: 409, code: "SEAT_UNAVAILABLE", selection: input.seats });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init?.headers as Record<string, string>)?.["Idempotency-Key"]).toBeTruthy();
    expect(JSON.parse(String(init?.body))).toMatchObject(input);
    vi.restoreAllMocks();
  });

  it("gera uma chave nova para cada tentativa de reserva, mas repete a chave explícita", async () => {
    vi.stubGlobal("window", {});
    const result = { reservationId: "reservation-1", orderNumber: "ABC123DEF456", expiresAt: new Date().toISOString(), totalCents: 1000, items: [] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(result), { status: 200 }));
    const input = { sessionId: "00000000-0000-4000-8000-000000000001", seats: [{ seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 }], buyer: { name: "Ana", email: "ana@example.com", phone: "11999999999" } };
    await reservarAssentos(input);
    await reservarAssentos(input);
    const firstKey = (fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>)["Idempotency-Key"];
    const secondKey = (fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>)["Idempotency-Key"];
    expect(firstKey).not.toBe(secondKey);
    await reservarAssentos({ ...input, idempotencyKey: "reserva-explicita-123456" });
    await reservarAssentos({ ...input, idempotencyKey: "reserva-explicita-123456" });
    expect((fetchMock.mock.calls[2]?.[1]?.headers as Record<string, string>)["Idempotency-Key"]).toBe("reserva-explicita-123456");
    expect((fetchMock.mock.calls[3]?.[1]?.headers as Record<string, string>)["Idempotency-Key"]).toBe("reserva-explicita-123456");
    vi.restoreAllMocks();
  });

  it("não envia buyer quando a reserva não o informa", async () => {
    vi.stubGlobal("window", {});
    const result = { reservationId: "reservation-1", orderNumber: "ABC123DEF456", expiresAt: new Date().toISOString(), subtotalCents: 1000, discountCents: 0, totalCents: 1000, appliedOffer: null, items: [] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));

    await reservarAssentos({
      sessionId: "00000000-0000-4000-8000-000000000001",
      seats: [{ seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 }],
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty("buyer");
    vi.restoreAllMocks();
  });

  it("inicia pagamento enviando returnUrl", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ clientSecret: "cs_test", expiresAt: new Date().toISOString(), orderNumber: "ABC123DEF456" }), { status: 200 }));

    await expect(iniciarPagamento("ABC123DEF456", { returnUrl: "https://eventos.portalcef.com.br/pedido/ABC123DEF456" })).resolves.toMatchObject({ clientSecret: "cs_test" });
    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe("/api/eventos/public/pedidos/ABC123DEF456/checkout");
    expect(JSON.parse(String(init?.body))).toMatchObject({ returnUrl: "https://eventos.portalcef.com.br/pedido/ABC123DEF456" });
    vi.restoreAllMocks();
  });

  it("recusa clientSecret vazio ao iniciar pagamento", async () => {
    vi.stubGlobal("window", {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ clientSecret: "", expiresAt: new Date().toISOString(), orderNumber: "ABC123DEF456" }), { status: 200 }));

    await expect(iniciarPagamento("ABC123DEF456", { returnUrl: "https://eventos.portalcef.com.br/pedido/ABC123DEF456" })).rejects.toMatchObject({ status: 502, code: "CHECKOUT_CLIENT_SECRET_INVALID" });
    vi.restoreAllMocks();
  });

  it("libera o pedido com POST no endpoint de liberação", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ liberado: true }), { status: 200 }));

    await expect(liberarPedido("ABC123DEF456")).resolves.toBeUndefined();
    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe("/api/eventos/public/pedidos/ABC123DEF456/liberar");
    expect(init?.method).toBe("POST");
    vi.restoreAllMocks();
  });

  it("codifica o acesso ao buscar ingressos", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ orderNumber: "ABC123DEF456", tickets: [] }), { status: 200 }));

    await obterIngressos("ABC/123", "token com espaço");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/eventos/public/pedidos/ABC%2F123/ingressos?acesso=token%20com%20espa%C3%A7o");
    vi.restoreAllMocks();
  });

  it("busca meus ingressos com POST e corpo JSON", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ pedidos: [] }), { status: 200 }));
    const input = { orderNumber: "ABC123DEF456", email: "ana@example.com" };

    await buscarMeusIngressos(input);
    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe("/api/eventos/public/meus-ingressos");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(input);
    vi.restoreAllMocks();
  });

  it("repassa x-real-ip nas leituras públicas", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ pedidos: [] }), { status: 200 }));
    const init = { headers: { "x-real-ip": "203.0.113.10" } };

    await listarEventosPublicos(init);
    await obterEventoPublico("evento", init);
    await listarSessoesPublicas("evento", init);
    await listarPoliticasPublicas("evento", init);
    await obterMapaSessao("sessao", init);
    await consultarPedido("ABC123DEF456", init);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    for (const [, requestInit] of fetchMock.mock.calls) {
      expect(requestInit?.headers).toMatchObject({ "x-real-ip": "203.0.113.10" });
    }
    vi.restoreAllMocks();
  });
});
