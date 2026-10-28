import { describe, expect, it, vi } from "vitest";
import { buscarApiPublica, iniciarCheckout, listarEventosPublicos, reservarAssentos } from "./eventos-api";

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

  it("retorna a checkoutUrl da API sem montar URL Stripe no cliente", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test" }), { status: 200 }));
    await expect(iniciarCheckout("ABC123DEF456", { successUrl: "https://eventos.portalcef.com.br/pedido/ABC123DEF456?retorno=sucesso", cancelUrl: "https://eventos.portalcef.com.br/checkout?retorno=cancelado" })).resolves.toEqual({ checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test" });
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("stripe.com");
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
});
