import { PaymentsService } from "./payments.service";

describe("PaymentsService.encerrarCheckoutSessionSeAberta", () => {
  function criarServico() {
    const service = new PaymentsService({ get: () => "sk_test_x" } as any);
    const retrieve = jest.fn();
    const expire = jest.fn();
    (service as any).stripe = { checkout: { sessions: { retrieve, expire } } };
    return { service, retrieve, expire };
  }

  it("expira uma sessão aberta", async () => {
    const { service, retrieve, expire } = criarServico();
    retrieve.mockResolvedValue({ status: "open" });

    await expect(service.encerrarCheckoutSessionSeAberta("cs_aberta")).resolves.toBe("expirada");
    expect(expire).toHaveBeenCalledWith("cs_aberta");
  });

  it("devolve concluida sem tentar expirar sessão paga", async () => {
    const { service, retrieve, expire } = criarServico();
    retrieve.mockResolvedValue({ status: "complete" });

    await expect(service.encerrarCheckoutSessionSeAberta("cs_paga")).resolves.toBe("concluida");
    expect(expire).not.toHaveBeenCalled();
  });

  it("devolve encerrada para sessão já expirada", async () => {
    const { service, retrieve, expire } = criarServico();
    retrieve.mockResolvedValue({ status: "expired" });

    await expect(service.encerrarCheckoutSessionSeAberta("cs_expirada")).resolves.toBe("encerrada");
    expect(expire).not.toHaveBeenCalled();
  });

  it("propaga erros do Stripe", async () => {
    const { service } = criarServico();
    const error = new Error("Stripe indisponível");
    (service as any).stripe.checkout.sessions.retrieve.mockRejectedValue(error);

    await expect(service.encerrarCheckoutSessionSeAberta("cs_erro")).rejects.toBe(error);
  });
});
