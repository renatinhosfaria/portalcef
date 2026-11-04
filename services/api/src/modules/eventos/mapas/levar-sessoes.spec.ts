import {
  eventoInventarioAssentos,
  eventoItensPedido,
  eventoMapaAssentos,
  eventoMapas,
  eventoPedidos,
  eventoReservas,
  eventoSessoes,
} from "@essencia/db";

import { levarSessoesParaVersao } from "./levar-sessoes";

type Estado = {
  sessoes: any[];
  assentos: any[];
  mapas: any[];
  inventario: any[];
  pedidos: any[];
  itens: any[];
  reservas: any[];
};

function bancoEmMemoria(estado: Estado) {
  const dbModule = jest.requireMock("@essencia/db") as any;
  const linhas = (tabela: unknown) => tabela === eventoSessoes ? estado.sessoes : tabela === eventoMapas ? estado.mapas : tabela === eventoMapaAssentos ? estado.assentos : tabela === eventoInventarioAssentos ? estado.inventario : tabela === eventoPedidos ? estado.pedidos : tabela === eventoItensPedido ? estado.itens : tabela === eventoReservas ? estado.reservas : [];
  const combinar = (condicao: any, linha: any): boolean => {
    if (!condicao) return true;
    if (condicao.name === "and") return condicao.args.every((item: any) => combinar(item, linha));
    if (condicao.name === "eq") return linha[condicao.args[0]?.__column] === condicao.args[1];
    if (condicao.name === "inArray") return condicao.args[1].includes(linha[condicao.args[0]?.__column]);
    return true;
  };
  const criarConsulta = (tabela: unknown, condicao?: any) => {
    const consulta: any = Promise.resolve(linhas(tabela).filter((linha: any) => combinar(condicao, linha)));
    consulta.__tabela = tabela;
    consulta.orderBy = () => consulta;
    consulta.for = () => consulta;
    return consulta;
  };
  const db: any = {
    select: () => ({ from: (tabela: unknown) => ({ where: (condicao: any) => criarConsulta(tabela, condicao) }) }),
    update: (tabela: unknown) => ({ set: (valores: any) => ({ where: async (condicao: any) => {
      linhas(tabela).filter((linha: any) => combinar(condicao, linha)).forEach((linha: any) => Object.assign(linha, valores));
      return { returning: async () => linhas(tabela).filter((linha: any) => combinar(condicao, linha)) };
    } }) }),
    delete: (tabela: unknown) => ({ where: async (condicao: any) => {
      const alvo = linhas(tabela);
      const restantes = alvo.filter((linha: any) => !combinar(condicao, linha));
      if (tabela === eventoInventarioAssentos) estado.inventario = restantes;
      if (tabela === eventoItensPedido) estado.itens = restantes;
      if (tabela === eventoReservas) estado.reservas = restantes;
    } }),
    insert: (tabela: unknown) => ({ values: async (valores: any) => {
      if (tabela === eventoInventarioAssentos) estado.inventario.push({ id: `novo-${estado.inventario.length + 1}`, ...valores });
      return [{ ...valores }];
    } }),
  };
  const ordem: unknown[] = [];
  const lockRows = async <T>(query: any) => {
    ordem.push(query.__tabela);
    return (await query) as T[];
  };
  return { db, lockRows, ordem };
}

const agora = new Date("2026-11-04T12:00:00Z");

describe("levar sessões para uma versão", () => {
  it("trava sessões, mapa e inventário nessa ordem", async () => {
    const estado: Estado = { sessoes: [{ id: "s1", eventId: "e1" }], mapas: [{ id: "v1" }], assentos: [{ id: "a1", mapId: "v1", sellable: true }], inventario: [], pedidos: [], itens: [], reservas: [] };
    const banco = bancoEmMemoria(estado);
    await levarSessoesParaVersao(banco.db, { eventId: "e1", versaoId: "v1", agora, lockRows: banco.lockRows });
    expect(banco.ordem[0]).toBe(eventoSessoes);
    expect(banco.ordem[1]).toBe(eventoMapas);
    expect(banco.ordem[2]).toBe(eventoInventarioAssentos);
  });

  it("leva todas as sessões, refaz o inventário e ajusta a capacidade", async () => {
    const estado: Estado = { sessoes: [{ id: "s1", eventId: "e1", mapId: "antigo", capacity: 9 }, { id: "s2", eventId: "e1", mapId: "antigo", capacity: 9 }], mapas: [{ id: "v1" }], assentos: [{ id: "a1", mapId: "v1", sellable: true }, { id: "a2", mapId: "v1", sellable: false }, { id: "a3", mapId: "v1", sellable: true }], inventario: [{ id: "i1", sessionId: "s1", seatId: "velho", status: "DISPONIVEL" }], pedidos: [], itens: [], reservas: [] };
    const banco = bancoEmMemoria(estado);
    const resultado = await levarSessoesParaVersao(banco.db, { eventId: "e1", versaoId: "v1", agora, lockRows: banco.lockRows });
    expect(resultado).toEqual({ sessionIds: ["s1", "s2"], inventarioCriado: 6, capacidade: 2, pedidosDesligados: [] });
    expect(estado.inventario).toHaveLength(6);
    expect(estado.inventario.filter((item) => item.status === "BLOQUEADO")).toHaveLength(2);
    expect(estado.sessoes.every((sessao) => sessao.mapId === "v1" && sessao.capacity === 2)).toBe(true);
  });

  it("desliga tentativa encerrada e marca o pedido aberto vencido como EXPIRADO", async () => {
    const estado: Estado = { sessoes: [{ id: "s1", eventId: "e1" }], mapas: [{ id: "v1" }], assentos: [{ id: "a1", mapId: "v1", sellable: true }], inventario: [{ id: "i1", sessionId: "s1", seatId: "a1", status: "RESERVADO" }], pedidos: [{ id: "p1", sessionId: "s1", status: "AGUARDANDO_PAGAMENTO", expiresAt: new Date("2026-11-04T11:00:00Z") }], itens: [{ id: "item1", orderId: "p1", inventorySeatId: "i1" }], reservas: [{ id: "res1", orderId: "p1", inventorySeatId: "i1" }] };
    const banco = bancoEmMemoria(estado);
    const resultado = await levarSessoesParaVersao(banco.db, { eventId: "e1", versaoId: "v1", agora, lockRows: banco.lockRows });
    expect(resultado.pedidosDesligados).toEqual(["p1"]);
    expect(estado.pedidos[0].status).toBe("EXPIRADO");
    expect(estado.itens).toHaveLength(0);
    expect(estado.reservas).toHaveLength(0);
  });

  it("mantém o registro do pedido CANCELADO e só apaga itens e reservas", async () => {
    const estado: Estado = { sessoes: [{ id: "s1", eventId: "e1" }], mapas: [{ id: "v1" }], assentos: [{ id: "a1", mapId: "v1", sellable: true }], inventario: [{ id: "i1", sessionId: "s1", seatId: "a1" }], pedidos: [{ id: "p1", sessionId: "s1", status: "CANCELADO", expiresAt: null }], itens: [{ id: "item1", orderId: "p1", inventorySeatId: "i1" }], reservas: [{ id: "res1", orderId: "p1", inventorySeatId: "i1" }] };
    const banco = bancoEmMemoria(estado);
    await levarSessoesParaVersao(banco.db, { eventId: "e1", versaoId: "v1", agora, lockRows: banco.lockRows });
    expect(estado.pedidos[0].status).toBe("CANCELADO");
    expect(estado.itens).toHaveLength(0);
    expect(estado.reservas).toHaveLength(0);
  });

  it("recusa com VENDA_CONFIRMADA se um item pertence a pedido pago", async () => {
    const estado: Estado = { sessoes: [{ id: "s1", eventId: "e1" }], mapas: [{ id: "v1" }], assentos: [{ id: "a1", mapId: "v1", sellable: true }], inventario: [{ id: "i1", sessionId: "s1", seatId: "a1" }], pedidos: [{ id: "p1", sessionId: "s1", status: "CONFIRMADO", expiresAt: null }], itens: [{ id: "item1", orderId: "p1", inventorySeatId: "i1" }], reservas: [] };
    const banco = bancoEmMemoria(estado);
    await expect(levarSessoesParaVersao(banco.db, { eventId: "e1", versaoId: "v1", agora, lockRows: banco.lockRows })).rejects.toMatchObject({ response: { code: "VENDA_CONFIRMADA" } });
  });

  it("leva só as sessões pedidas quando sessionIds é informado", async () => {
    const estado: Estado = { sessoes: [{ id: "s1", eventId: "e1", mapId: "a" }, { id: "s2", eventId: "e1", mapId: "a" }], mapas: [{ id: "v1" }], assentos: [{ id: "a1", mapId: "v1", sellable: true }], inventario: [], pedidos: [], itens: [], reservas: [] };
    const banco = bancoEmMemoria(estado);
    const resultado = await levarSessoesParaVersao(banco.db, { eventId: "e1", versaoId: "v1", agora, sessionIds: ["s2"], lockRows: banco.lockRows });
    expect(resultado.sessionIds).toEqual(["s2"]);
    expect(estado.sessoes.find((sessao) => sessao.id === "s1").mapId).toBe("a");
  });

  it("evento sem sessão devolve capacidade null", async () => {
    const estado: Estado = { sessoes: [], mapas: [{ id: "v1" }], assentos: [{ id: "a1", mapId: "v1", sellable: true }], inventario: [], pedidos: [], itens: [], reservas: [] };
    const banco = bancoEmMemoria(estado);
    await expect(levarSessoesParaVersao(banco.db, { eventId: "e1", versaoId: "v1", agora, lockRows: banco.lockRows })).resolves.toMatchObject({ sessionIds: [], inventarioCriado: 0, capacidade: null });
  });
});
