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
    const pedidos = [{ id: "pedido-1", sessionId: "sessao-1", status: "INICIADO", expiresAt: depois }];
    const tabelas = new Map<unknown, unknown[]>([
      [eventoSessoes, [{ id: "sessao-1" }]],
      [eventoPedidos, pedidos],
      [eventoIngressos, []],
      [eventoCheckins, []],
      [eventoOperacoesAdministrativas, []],
    ]);
    const db: any = {
      select: () => ({
        from: (table: unknown) => ({ where: (condicao: unknown) => {
          const query: any = Promise.resolve(tabelas.get(table) ?? []);
          query.orderBy = jest.fn(() => query);
          return query;
        } }),
      }),
    };
    const lockRows = jest.fn(async <T>(_query: unknown) => pedidos as T[]);
    const tipo = await carregarTrava(db, "evento-1", agora, lockRows as any);
    expect(tipo).toBe("COMPRA_EM_ANDAMENTO");
    expect(lockRows).toHaveBeenCalledTimes(1);
    await expect(lockRows.mock.calls[0][0]).resolves.toEqual(pedidos);
    expect((lockRows.mock.calls[0][0] as any).orderBy).toHaveBeenCalledTimes(1);
  });

  // Procura na condição (o shim do jest representa operadores como { name, args })
  // os valores excluídos por notInArray.
  function statusExcluidos(no: any): unknown[] {
    if (!no || typeof no !== "object") return [];
    if (no.name === "notInArray") return no.args[1];
    return Array.isArray(no.args) ? no.args.flatMap(statusExcluidos) : [];
  }

  // O fake aplica de verdade o filtro de status da consulta de ingressos:
  // descarta as linhas cujo status foi excluído pela condição.
  async function trava(ingressos: Array<{ id: string; status: string }>) {
    const tabelas = new Map<unknown, unknown[]>([
      [eventoSessoes, [{ id: "sessao-1" }]],
      [eventoPedidos, []],
      [eventoIngressos, ingressos],
      [eventoCheckins, []],
      [eventoOperacoesAdministrativas, []],
    ]);
    const db: any = {
      select: () => ({
        from: (table: unknown) => ({
          where: (condicao: any) => {
            const linhas = tabelas.get(table) ?? [];
            if (table !== eventoIngressos) return Promise.resolve(linhas);
            const excluidos = statusExcluidos(condicao);
            return Promise.resolve(
              (linhas as Array<{ status: string }>).filter(({ status }) => !excluidos.includes(status)),
            );
          },
        }),
      }),
    };
    return carregarTrava(db, "evento-1", agora);
  }

  it("ignora ingressos cancelados ao decidir se o mapa está travado", async () => {
    await expect(trava([{ id: "ingresso-cortesia", status: "CANCELADO" }])).resolves.toBe("LIVRE");
  });

  it("ignora ingressos revogados ao decidir se o mapa está travado", async () => {
    await expect(trava([{ id: "ingresso-cortesia", status: "REVOGADO" }])).resolves.toBe("LIVRE");
  });

  it("ingresso emitido continua travando o mapa", async () => {
    await expect(trava([{ id: "ingresso-1", status: "EMITIDO" }])).resolves.toBe("VENDA_CONFIRMADA");
    await expect(
      trava([{ id: "a", status: "CANCELADO" }, { id: "b", status: "EMITIDO" }]),
    ).resolves.toBe("VENDA_CONFIRMADA");
  });
});
