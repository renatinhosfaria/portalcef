import { eventoCheckins, eventoIngressos, eventoOperacoesAdministrativas, eventoPedidos, eventoSessoes } from "@essencia/db";

import {
  classificarTrava,
  exigirMapaLivre,
  carregarTrava,
  MENSAGEM_TRAVA,
} from "./trava-venda";

describe("trava de venda", () => {
  const agora = new Date("2026-11-04T12:00:00Z");
  const depois = new Date("2026-11-04T12:10:00Z");
  const antes = new Date("2026-11-04T11:50:00Z");

  it.each(["CONFIRMADO", "USADO", "NO_SHOW", "REEMBOLSADO"])(
    "pedido %s é venda confirmada",
    (status) => {
      expect(classificarTrava({ pedidos: [{ status, expiresAt: null }], ingressos: 0, checkins: 0, operacoesAtivas: 0 }, agora)).toBe("VENDA_CONFIRMADA");
    },
  );

  it("ingresso ou check-in é venda confirmada", () => {
    expect(classificarTrava({ pedidos: [], ingressos: 1, checkins: 0, operacoesAtivas: 0 }, agora)).toBe("VENDA_CONFIRMADA");
    expect(classificarTrava({ pedidos: [], ingressos: 0, checkins: 1, operacoesAtivas: 0 }, agora)).toBe("VENDA_CONFIRMADA");
  });

  it.each(["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO"])(
    "pedido %s ainda no prazo é compra em andamento",
    (status) => {
      expect(classificarTrava({ pedidos: [{ status, expiresAt: depois }], ingressos: 0, checkins: 0, operacoesAtivas: 0 }, agora)).toBe("COMPRA_EM_ANDAMENTO");
    },
  );

  it("pedido aberto vencido, expirado ou cancelado não trava", () => {
    expect(classificarTrava({ pedidos: [{ status: "INICIADO", expiresAt: antes }], ingressos: 0, checkins: 0, operacoesAtivas: 0 }, agora)).toBe("LIVRE");
    expect(classificarTrava({ pedidos: [{ status: "EXPIRADO", expiresAt: null }], ingressos: 0, checkins: 0, operacoesAtivas: 0 }, agora)).toBe("LIVRE");
    expect(classificarTrava({ pedidos: [{ status: "CANCELADO", expiresAt: null }], ingressos: 0, checkins: 0, operacoesAtivas: 0 }, agora)).toBe("LIVRE");
  });

  it("operação ativa trava e venda vence operação e compra em andamento", () => {
    expect(classificarTrava({ pedidos: [{ status: "INICIADO", expiresAt: depois }], ingressos: 0, checkins: 0, operacoesAtivas: 1 }, agora)).toBe("OPERACAO_ATIVA");
    expect(classificarTrava({ pedidos: [{ status: "CONFIRMADO", expiresAt: null }], ingressos: 0, checkins: 0, operacoesAtivas: 1 }, agora)).toBe("VENDA_CONFIRMADA");
  });

  it("exigirMapaLivre lança o código e a mensagem exatos", () => {
    expect(() => exigirMapaLivre("VENDA_CONFIRMADA")).toThrow(
      expect.objectContaining({ response: { code: "VENDA_CONFIRMADA", message: MENSAGEM_TRAVA.VENDA_CONFIRMADA } }),
    );
    expect(() => exigirMapaLivre("LIVRE")).not.toThrow();
  });

  it("carregarTrava lê os dados do evento e permite travar a leitura de pedidos", async () => {
    const pedidos = [{ status: "INICIADO", expiresAt: depois }];
    const tabelas = new Map<unknown, unknown[]>([
      [eventoSessoes, [{ id: "sessao-1" }]],
      [eventoPedidos, pedidos],
      [eventoIngressos, []],
      [eventoCheckins, []],
      [eventoOperacoesAdministrativas, []],
    ]);
    const db: any = {
      select: () => ({
        from: (table: unknown) => ({ where: async () => tabelas.get(table) ?? [] }),
      }),
    };
    const lockRows = jest.fn(async <T>(query: unknown) => query as T[]);
    const tipo = await carregarTrava(db, "evento-1", agora, lockRows as any);
    expect(tipo).toBe("COMPRA_EM_ANDAMENTO");
    expect(lockRows).toHaveBeenCalledTimes(1);
  });
});
