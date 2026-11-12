import type { EmitirCortesiasInput } from "@essencia/shared/schemas";
import type { EventoActor } from "@essencia/shared/types";
import { EventosCortesiasService } from "./eventos-cortesias.service";

beforeAll(() => { process.env.EVENTOS_QR_SECRET = "teste-segredo-qr"; });

const ator: EventoActor = { userId: "user-1", role: "gerente_unidade", schoolId: "escola-1" };

function lote(ids: string[], extra: Partial<EmitirCortesiasInput> = {}): EmitirCortesiasInput {
  return {
    sessionId: "session-1",
    chave: "chave-1",
    grupo: "Professores",
    motivo: "Convidados da direção",
    assentos: ids.map((inventorySeatId) => ({ inventorySeatId })),
    ...extra,
  };
}

describe("EventosCortesiasService.emitir", () => {
  let db: FakeCortesiasDb;
  let service: EventosCortesiasService;

  beforeEach(() => {
    db = new FakeCortesiasDb();
    service = new EventosCortesiasService({ db } as any);
  });

  it("emite uma cortesia por assento, tudo de valor zero", async () => {
    const r = await service.emitir("event-1", lote(["inv-1", "inv-2"]), ator);

    expect(r).toHaveLength(2);
    expect(db.state.pedidos).toHaveLength(2);
    expect(db.state.pedidos.every((p) => p.status === "CONFIRMADO" && p.origin === "CORTESIA" && p.totalCents === 0 && p.subtotalCents === 0 && p.discountCents === 0 && p.expiresAt === null && p.confirmedAt instanceof Date && p.buyerName === "Professores")).toBe(true);
    expect(db.state.pedidos[0].idempotencyKey).toBe("cortesia:chave-1:inv-1");
    expect(db.state.pedidos.every((p) => /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/.test(p.orderNumber))).toBe(true);
    expect(db.state.itens.every((i) => i.unitPriceCents === 0 && i.totalPriceCents === 0 && i.pricingEvidence?.origem === "CORTESIA")).toBe(true);
    expect(db.state.participantes.every((p) => p.type === "CONVIDADO")).toBe(true);
    expect(db.state.ingressos.map((i) => i.status)).toEqual(["EMITIDO", "EMITIDO"]);
    expect(db.state.ingressos.every((i) => i.signedToken.includes(".") && /^[A-Z2-9]{8}$/.test(i.numero))).toBe(true);
    expect(db.state.operacoes).toHaveLength(2);
    expect(db.state.operacoes.every((o) => o.type === "CORTESIA" && o.status === "ATIVA" && o.createdBy === "user-1" && o.reason === "Convidados da direção" && o.orderId && o.participantId)).toBe(true);
    expect(db.inventario("inv-1")).toMatchObject({ status: "VENDIDO", reservedByOrderId: null });
    expect(db.inventario("inv-1").soldAt).toBeInstanceOf(Date);
    expect(db.inventario("inv-3").status).toBe("DISPONIVEL");
    expect(db.state.auditorias).toEqual([expect.objectContaining({ action: "CORTESIA_EMITIDA", resourceType: "cortesia", actorId: "user-1", actorRole: "gerente_unidade", sessionId: "session-1", reason: "Convidados da direção", metadata: expect.objectContaining({ grupo: "Professores", quantidade: 2, orderNumbers: db.state.pedidos.map((p) => p.orderNumber) }) })]);
    expect(db.state.pagamentos ?? []).toHaveLength(0);
    expect(r[0]).toMatchObject({ orderNumber: db.state.pedidos[0].orderNumber, rowLabel: "A", seatNumber: "1", participantName: "Professores", grupo: "Professores", motivo: "Convidados da direção", situacao: "ATIVA", emitidaPor: "Secretaria Ana", canceladaEm: null, session: { id: "session-1" } });
  });

  it("usa o nome do assento e, na falta, o nome do grupo", async () => {
    const entrada = lote(["inv-1", "inv-2"]);
    entrada.assentos[0]!.nome = "Maria Souza";

    const r = await service.emitir("event-1", entrada, ator);

    expect(db.state.participantes.map((p) => p.fullName)).toEqual(["Maria Souza", "Professores"]);
    expect(r.map((c) => c.participantName).sort()).toEqual(["Maria Souza", "Professores"]);
  });

  it("grava o contato do grupo no pedido", async () => {
    await service.emitir("event-1", lote(["inv-1"], { contatoEmail: "grupo@example.com", contatoTelefone: "11999990000" }), ator);

    expect(db.state.pedidos[0]).toMatchObject({ buyerEmail: "grupo@example.com", buyerPhone: "11999990000" });
  });

  it("cria o tipo Cortesia uma vez e reutiliza", async () => {
    db.state.tipos.push({ id: "tipo-publico", eventId: "event-1", name: "Cortesia", priceCents: 5_000, internal: false, active: true });

    await service.emitir("event-1", lote(["inv-1"]), ator);
    await service.emitir("event-1", lote(["inv-2"], { chave: "chave-2" }), ator);

    const internos = db.state.tipos.filter((t) => t.internal);
    expect(internos).toEqual([expect.objectContaining({ eventId: "event-1", name: "Cortesia", priceCents: 0, internal: true, active: true })]);
    expect(db.state.itens.map((i) => i.ticketTypeId)).toEqual([internos[0].id, internos[0].id]);
  });

  it("recusa o lote inteiro e lista todos os conflitos", async () => {
    db.inventario("inv-2").status = "VENDIDO";
    db.inventario("inv-3").status = "RESERVADO";
    db.inventario("inv-3").reservedByOrderId = "pedido-x";
    db.state.inventarios.push({ id: "inv-4", sessionId: "session-1", seatId: "seat-4", status: "BLOQUEADO", reservedByOrderId: null });

    await expect(service.emitir("event-1", lote(["inv-1", "inv-2", "inv-3", "inv-4"]), ator)).rejects.toMatchObject({
      status: 409,
      response: {
        code: "ASSENTOS_INDISPONIVEIS",
        message: "Um ou mais assentos não estão mais livres.",
        details: {
          conflitos: [
            { inventorySeatId: "inv-2", rowLabel: "A", seatNumber: "2", motivo: "VENDIDO" },
            { inventorySeatId: "inv-3", rowLabel: "A", seatNumber: "3", motivo: "RESERVADO" },
            { inventorySeatId: "inv-4", rowLabel: "B", seatNumber: "1", motivo: "BLOQUEADO" },
          ],
        },
      },
    });
    expect(db.state.pedidos).toHaveLength(0);
    expect(db.state.tipos).toHaveLength(0);
    expect(db.inventario("inv-1").status).toBe("DISPONIVEL");
  });

  it("recusa assento de outra sessão e assento inexistente", async () => {
    await expect(service.emitir("event-1", lote(["inv-1", "inv-outra", "inv-nao-existe"]), ator)).rejects.toMatchObject({
      response: {
        code: "ASSENTOS_INDISPONIVEIS",
        details: {
          conflitos: [
            { inventorySeatId: "inv-outra", rowLabel: "A", seatNumber: "1", motivo: "OUTRA_SESSAO" },
            { inventorySeatId: "inv-nao-existe", rowLabel: "", seatNumber: "", motivo: "INEXISTENTE" },
          ],
        },
      },
    });
    expect(db.state.pedidos).toHaveLength(0);
    expect(db.inventario("inv-outra").status).toBe("DISPONIVEL");
  });

  it("trata assento LIBERADO como livre", async () => {
    db.inventario("inv-1").status = "LIBERADO";

    await expect(service.emitir("event-1", lote(["inv-1"]), ator)).resolves.toHaveLength(1);
    expect(db.inventario("inv-1").status).toBe("VENDIDO");
  });

  it("recusa assento DISPONIVEL com reservedByOrderId preenchido", async () => {
    db.inventario("inv-1").reservedByOrderId = "pedido-x";

    await expect(service.emitir("event-1", lote(["inv-1"]), ator)).rejects.toMatchObject({
      response: { code: "ASSENTOS_INDISPONIVEIS", details: { conflitos: [{ inventorySeatId: "inv-1", motivo: "RESERVADO" }] } },
    });
    expect(db.state.pedidos).toHaveLength(0);
  });

  it("trava evento e sessão e depois o inventário em ordem crescente de id", async () => {
    await service.emitir("event-1", lote(["inv-3", "inv-1"]), ator);

    expect(db.lockSequence).toEqual(["no key update:event-1", "no key update:session-1", "update:inv-1", "update:inv-3"]);
  });

  it("repetir a mesma chave não duplica", async () => {
    const primeira = await service.emitir("event-1", lote(["inv-1"]), ator);
    const segunda = await service.emitir("event-1", lote(["inv-1"]), ator);

    expect(db.state.pedidos).toHaveLength(1);
    expect(db.state.auditorias).toHaveLength(1);
    expect(segunda.map((c) => c.orderNumber)).toEqual(primeira.map((c) => c.orderNumber));
  });

  it("mesma chave com assentos diferentes devolve a emissão original", async () => {
    const primeira = await service.emitir("event-1", lote(["inv-1"]), ator);
    const segunda = await service.emitir("event-1", lote(["inv-2"]), ator);

    expect(segunda).toEqual(primeira);
    expect(db.state.pedidos).toHaveLength(1);
    expect(db.inventario("inv-2").status).toBe("DISPONIVEL");
  });

  it("devolve a emissão vencedora quando outra requisição grava a mesma chave antes", async () => {
    const primeira = await service.emitir("event-1", lote(["inv-1"]), ator);
    db.ocultarBuscaPorChaveUmaVez = true;
    db.falhasInsercao.push({ tabela: "pedidos", erro: { code: "23505", constraint_name: "uq_evento_pedidos_idempotency_key" } });

    const segunda = await service.emitir("event-1", lote(["inv-2"]), ator);

    expect(segunda).toEqual(primeira);
    expect(db.state.pedidos).toHaveLength(1);
    expect(db.inventario("inv-2").status).toBe("DISPONIVEL");
  });

  it("responde 409 quando o inventário muda entre a leitura e a gravação", async () => {
    db.updateInventarioSemEfeito = true;

    await expect(service.emitir("event-1", lote(["inv-1", "inv-2"]), ator)).rejects.toMatchObject({
      status: 409,
      response: { code: "ASSENTOS_INDISPONIVEIS", details: { conflitos: [expect.objectContaining({ inventorySeatId: "inv-1" }), expect.objectContaining({ inventorySeatId: "inv-2" })] } },
    });
    expect(db.state.pedidos).toHaveLength(0);
  });

  it("sorteia de novo quando o número do pedido colide", async () => {
    db.falhasInsercao.push({ tabela: "pedidos", erro: { code: "23505", constraint: "uq_evento_pedidos_order_number" } });

    await expect(service.emitir("event-1", lote(["inv-1"]), ator)).resolves.toHaveLength(1);
    expect(db.transacoes).toBe(2);
    expect(db.state.pedidos).toHaveLength(1);
    expect(db.state.auditorias).toHaveLength(1);
  });

  it("sorteia de novo quando o número do ingresso colide, com o erro embrulhado pelo Drizzle", async () => {
    db.falhasInsercao.push({ tabela: "ingressos", erro: { message: "Failed query", cause: { code: "23505", constraint_name: "uq_evento_ingressos_numero" } } });

    await expect(service.emitir("event-1", lote(["inv-1"]), ator)).resolves.toHaveLength(1);
    expect(db.transacoes).toBe(2);
    expect(db.state.ingressos).toHaveLength(1);
  });

  it("desiste depois de 5 colisões seguidas", async () => {
    const erro = { code: "23505", constraint: "uq_evento_pedidos_order_number" };
    for (let i = 0; i < 5; i += 1) db.falhasInsercao.push({ tabela: "pedidos", erro });

    await expect(service.emitir("event-1", lote(["inv-1"]), ator)).rejects.toBe(erro);
    expect(db.transacoes).toBe(5);
    expect(db.state.pedidos).toHaveLength(0);
  });

  it("emite com evento em rascunho e pausado; recusa cancelado", async () => {
    await expect(service.emitir("event-1", lote(["inv-1"]), ator)).resolves.toHaveLength(1);
    db.state.eventos[0].status = "PAUSADO";
    await expect(service.emitir("event-1", lote(["inv-2"], { chave: "chave-2" }), ator)).resolves.toHaveLength(1);
    db.state.eventos[0].status = "CANCELADO";
    await expect(service.emitir("event-1", lote(["inv-3"], { chave: "chave-3" }), ator)).rejects.toMatchObject({ status: 409, response: { code: "EVENTO_CANCELADO" } });
    expect(db.inventario("inv-3").status).toBe("DISPONIVEL");
  });

  it("recusa evento inexistente", async () => {
    await expect(service.emitir("event-x", lote(["inv-1"]), ator)).rejects.toMatchObject({ status: 404, response: { code: "EVENT_NOT_FOUND" } });
  });

  it("recusa sessão de outro evento, sessão cancelada e mapa não confirmado", async () => {
    await expect(service.emitir("event-1", lote(["inv-1"], { sessionId: "session-outro-evento" }), ator)).rejects.toMatchObject({ status: 404, response: { code: "SESSION_NOT_FOUND" } });

    db.state.sessoes[0].status = "CANCELADA";
    await expect(service.emitir("event-1", lote(["inv-1"]), ator)).rejects.toMatchObject({ status: 404, response: { code: "SESSION_NOT_FOUND" } });
    db.state.sessoes[0].status = "RASCUNHO";

    db.state.mapas[0].status = "EM_REVISAO";
    await expect(service.emitir("event-1", lote(["inv-1"]), ator)).rejects.toMatchObject({ status: 409, response: { code: "MAP_NOT_CONFIRMED" } });

    db.state.mapas[0].status = "CONFIRMADO";
    db.state.sessoes[0].mapId = null;
    await expect(service.emitir("event-1", lote(["inv-1"]), ator)).rejects.toMatchObject({ status: 409, response: { code: "MAP_NOT_CONFIRMED" } });
    expect(db.state.pedidos).toHaveLength(0);
  });

  it("recusa evento de outra escola", async () => {
    await expect(service.emitir("event-1", lote(["inv-1"]), { ...ator, schoolId: "escola-2" })).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
    expect(db.state.pedidos).toHaveLength(0);
  });

  it("não grava nada quando falta EVENTOS_QR_SECRET", async () => {
    const original = process.env.EVENTOS_QR_SECRET;
    delete process.env.EVENTOS_QR_SECRET;
    try {
      await expect(service.emitir("event-1", lote(["inv-1"]), ator)).rejects.toMatchObject({ response: { code: "EVENTOS_QR_SECRET_MISSING" } });
    } finally {
      process.env.EVENTOS_QR_SECRET = original;
    }
    expect(db.state.pedidos).toHaveLength(0);
    expect(db.state.operacoes).toHaveLength(0);
    expect(db.state.auditorias).toHaveLength(0);
    expect(db.inventario("inv-1").status).toBe("DISPONIVEL");
    expect(db.transacoes).toBe(1);
  });
});

describe("EventosCortesiasService.listar", () => {
  it("lista da mais recente para a mais antiga com a situação", async () => {
    const db = new FakeCortesiasDb();
    const service = new EventosCortesiasService({ db } as any);
    await service.emitir("event-1", lote(["inv-1"], { chave: "chave-a", grupo: "Grupo A" }), ator);
    await service.emitir("event-1", lote(["inv-2"], { chave: "chave-b", grupo: "Grupo B" }), ator);
    await service.emitir("event-1", lote(["inv-3"], { chave: "chave-c", grupo: "Grupo C" }), ator);
    const [opA, opB, opC] = db.state.operacoes;
    opA.createdAt = new Date("2026-11-10T10:00:00Z");
    opB.createdAt = new Date("2026-11-12T10:00:00Z");
    opC.createdAt = new Date("2026-11-11T10:00:00Z");
    db.state.ingressos.find((i) => i.orderId === opC.orderId)!.status = "USADO";
    const pedidoA = db.state.pedidos.find((p) => p.id === opA.orderId)!;
    pedidoA.status = "CANCELADO";
    opA.status = "CANCELADA";
    opA.cancelledAt = new Date("2026-11-12T12:00:00Z");

    const lista = await service.listar("event-1", ator);

    expect(lista.map((c) => [c.grupo, c.situacao])).toEqual([["Grupo B", "ATIVA"], ["Grupo C", "USADA"], ["Grupo A", "CANCELADA"]]);
    expect(lista[2]).toMatchObject({ orderId: pedidoA.id, orderNumber: pedidoA.orderNumber, rowLabel: "A", seatNumber: "1", emitidaPor: "Secretaria Ana", emitidaEm: opA.createdAt, canceladaEm: new Date("2026-11-12T12:00:00Z"), numero: db.state.ingressos.find((i) => i.orderId === pedidoA.id)!.numero, session: { id: "session-1", startsAt: new Date("2026-12-10T19:00:00Z") } });
  });

  it("ignora operações de outro tipo e de outro evento", async () => {
    const db = new FakeCortesiasDb();
    const service = new EventosCortesiasService({ db } as any);
    await service.emitir("event-1", lote(["inv-1"]), ator);
    db.state.operacoes.push({ ...db.state.operacoes[0], id: "op-bloqueio", type: "BLOQUEIO" });
    db.state.operacoes.push({ ...db.state.operacoes[0], id: "op-outro", eventId: "event-2" });

    await expect(service.listar("event-1", ator)).resolves.toHaveLength(1);
  });

  it("recusa evento de outra escola e evento inexistente", async () => {
    const db = new FakeCortesiasDb();
    const service = new EventosCortesiasService({ db } as any);

    await expect(service.listar("event-1", { ...ator, schoolId: "escola-2" })).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
    await expect(service.listar("event-x", ator)).rejects.toMatchObject({ status: 404, response: { code: "EVENT_NOT_FOUND" } });
  });
});

describe("EventosCortesiasService.cancelar", () => {
  let db: FakeCortesiasDb;
  let service: EventosCortesiasService;

  beforeEach(() => {
    db = new FakeCortesiasDb();
    service = new EventosCortesiasService({ db } as any);
  });

  it("cancela: invalida o ingresso, cancela o pedido e libera o assento", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);

    const r = await service.cancelar("event-1", c!.orderId, { motivo: "Convidado desistiu" }, ator);

    expect(r.situacao).toBe("CANCELADA");
    expect(r.orderId).toBe(c!.orderId);
    expect(r.canceladaEm).toBeInstanceOf(Date);
    expect(db.state.ingressos[0]).toMatchObject({ status: "CANCELADO", revokedAt: expect.any(Date) });
    expect(db.state.pedidos[0]).toMatchObject({ status: "CANCELADO", cancellationReason: "Convidado desistiu", cancelledAt: expect.any(Date) });
    expect(db.state.operacoes[0]).toMatchObject({ status: "CANCELADA", cancelledAt: expect.any(Date) });
    expect(db.inventario("inv-1")).toMatchObject({ status: "DISPONIVEL", soldAt: null });
    expect(db.state.auditorias.at(-1)).toMatchObject({ action: "CORTESIA_CANCELADA", resourceType: "cortesia", resourceId: c!.orderId, sessionId: "session-1", actorId: "user-1", actorRole: "gerente_unidade", reason: "Convidado desistiu", metadata: { orderNumber: c!.orderNumber } });
  });

  it("trava evento e sessão (NO KEY UPDATE), depois pedido, inventário e ingresso", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
    db.lockSequence = [];

    await service.cancelar("event-1", c!.orderId, { motivo: "Convidado desistiu" }, ator);

    expect(db.lockSequence).toEqual(["no key update:event-1", "no key update:session-1", `update:${c!.orderId}`, "update:inv-1", `update:${db.state.ingressos[0]!.id}`]);
  });

  it("pedido inexistente ou de outro evento não trava sessão nem pedido", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
    db.state.eventos.push({ id: "event-2", schoolId: "escola-1", status: "RASCUNHO" });
    db.lockSequence = [];

    await expect(service.cancelar("event-2", c!.orderId, { motivo: "Convidado desistiu" }, ator)).rejects.toMatchObject({ status: 404, response: { code: "CORTESIA_NOT_FOUND" } });
    await expect(service.cancelar("event-1", "pedido-inexistente", { motivo: "Convidado desistiu" }, ator)).rejects.toMatchObject({ status: 404, response: { code: "CORTESIA_NOT_FOUND" } });

    expect(db.lockSequence).toEqual(["no key update:event-2", "no key update:event-1"]);
    expect(db.state.pedidos[0]!.status).toBe("CONFIRMADO");
  });

  it("o assento cancelado pode receber nova cortesia", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
    await service.cancelar("event-1", c!.orderId, { motivo: "Convidado desistiu" }, ator);

    const nova = await service.emitir("event-1", lote(["inv-1"], { chave: "chave-2", grupo: "Outro grupo" }), ator);

    expect(nova).toEqual([expect.objectContaining({ situacao: "ATIVA", rowLabel: "A", seatNumber: "1", grupo: "Outro grupo" })]);
    expect(db.inventario("inv-1").status).toBe("VENDIDO");
    const lista = await service.listar("event-1", ator);
    expect(lista.map((item) => item.situacao).sort()).toEqual(["ATIVA", "CANCELADA"]);
  });

  it("cancelar duas vezes não altera nada na segunda", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
    const primeira = await service.cancelar("event-1", c!.orderId, { motivo: "Convidado desistiu" }, ator);
    const antes = structuredClone(db.state);

    const segunda = await service.cancelar("event-1", c!.orderId, { motivo: "Outro motivo" }, ator);

    expect(segunda).toEqual(primeira);
    expect(db.state).toEqual(antes);
    expect(db.state.auditorias.filter((a) => a.action === "CORTESIA_CANCELADA")).toHaveLength(1);
    expect(db.state.pedidos[0]!.cancellationReason).toBe("Convidado desistiu");
  });

  it("não mexe no inventário que não está mais vendido", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
    db.inventario("inv-1").status = "BLOQUEADO";

    await expect(service.cancelar("event-1", c!.orderId, { motivo: "Convidado desistiu" }, ator)).resolves.toMatchObject({ situacao: "CANCELADA" });

    expect(db.inventario("inv-1").status).toBe("BLOQUEADO");
    expect(db.inventario("inv-1").soldAt).toBeInstanceOf(Date);
    expect(db.state.pedidos[0]!.status).toBe("CANCELADO");
  });

  it("recusa cancelar ingresso já usado", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
    db.state.ingressos[0]!.status = "USADO";

    await expect(service.cancelar("event-1", c!.orderId, { motivo: "Convidado desistiu" }, ator)).rejects.toMatchObject({ status: 409, response: { code: "CORTESIA_JA_UTILIZADA" } });

    expect(db.inventario("inv-1").status).toBe("VENDIDO");
    expect(db.state.pedidos[0]!.status).toBe("CONFIRMADO");
    expect(db.state.operacoes[0]!.status).toBe("ATIVA");
    expect(db.state.auditorias.filter((a) => a.action === "CORTESIA_CANCELADA")).toHaveLength(0);
  });

  it("responde não encontrado para pedido de venda e para pedido de outro evento", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
    db.state.pedidos.push({ id: "pedido-venda", eventId: "event-1", sessionId: "session-1", origin: "VENDA", status: "CONFIRMADO" });
    db.state.eventos.push({ id: "event-2", schoolId: "escola-1", status: "RASCUNHO" });
    const motivo = { motivo: "Convidado desistiu" };

    await expect(service.cancelar("event-1", "pedido-venda", motivo, ator)).rejects.toMatchObject({ status: 404, response: { code: "CORTESIA_NOT_FOUND" } });
    await expect(service.cancelar("event-2", c!.orderId, motivo, ator)).rejects.toMatchObject({ status: 404, response: { code: "CORTESIA_NOT_FOUND" } });
    await expect(service.cancelar("event-1", "pedido-inexistente", motivo, ator)).rejects.toMatchObject({ status: 404, response: { code: "CORTESIA_NOT_FOUND" } });
    expect(db.state.pedidos.find((p) => p.id === c!.orderId)!.status).toBe("CONFIRMADO");
    expect(db.state.pedidos.find((p) => p.id === "pedido-venda")!.status).toBe("CONFIRMADO");
  });

  it("recusa cancelar cortesia de outra escola", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);

    await expect(service.cancelar("event-1", c!.orderId, { motivo: "Convidado desistiu" }, { ...ator, schoolId: "escola-2" })).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });

    expect(db.state.pedidos[0]!.status).toBe("CONFIRMADO");
    expect(db.inventario("inv-1").status).toBe("VENDIDO");
  });
});

describe("EventosCortesiasService.obterVoucher", () => {
  let db: FakeCortesiasDb;
  let service: EventosCortesiasService;

  beforeEach(() => {
    db = new FakeCortesiasDb();
    service = new EventosCortesiasService({ db } as any);
    Object.assign(db.state.eventos[0]!, { title: "Espetáculo de Natal", slug: "espetaculo-de-natal", imageUrl: "https://exemplo/capa.png" });
  });

  it("voucher devolve PedidoComIngressos com evento em rascunho", async () => {
    const entrada = lote(["inv-1"]);
    entrada.assentos[0]!.nome = "Maria Souza";
    const [c] = await service.emitir("event-1", entrada, ator);
    const tipoId = db.state.tipos[0]!.id;

    const voucher = await service.obterVoucher("event-1", c!.orderId, ator);

    expect(voucher).toMatchObject({
      orderNumber: c!.orderNumber,
      status: "CONFIRMADO",
      eventTitle: "Espetáculo de Natal",
      eventSlug: "espetaculo-de-natal",
      sessionId: "session-1",
      expiresAt: null,
      session: { startsAt: new Date("2026-12-10T19:00:00Z"), endsAt: new Date("2026-12-10T21:00:00Z") },
      subtotalCents: 0,
      discountCents: 0,
      totalCents: 0,
      appliedOffer: null,
      items: [{ seatId: "seat-1", ticketTypeId: tipoId, unitPriceCents: 0, totalPriceCents: 0, rowLabel: "A", seatNumber: "1", ticketTypeName: "Cortesia" }],
      buyerName: "Professores",
      event: { title: "Espetáculo de Natal", slug: "espetaculo-de-natal", imageUrl: "https://exemplo/capa.png", locationName: "Teatro Municipal" },
    });
    expect(voucher.tickets).toEqual([{ numero: db.state.ingressos[0]!.numero, qrPayload: db.state.ingressos[0]!.qrPayload, rowLabel: "A", seatNumber: "1", ticketTypeName: "Cortesia", participantName: "Maria Souza", status: "EMITIDO" }]);
    expect(voucher.tickets[0]!.qrPayload).toEqual(expect.any(String));
  });

  it("voucher sem local na sessão devolve locationName nulo", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
    db.state.sessoes[0]!.locationId = null;

    await expect(service.obterVoucher("event-1", c!.orderId, ator)).resolves.toMatchObject({ event: { locationName: null } });
  });

  it("voucher de cortesia cancelada responde não encontrado", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
    await service.cancelar("event-1", c!.orderId, { motivo: "Convidado desistiu" }, ator);

    await expect(service.obterVoucher("event-1", c!.orderId, ator)).rejects.toMatchObject({ status: 404, response: { code: "CORTESIA_NOT_FOUND" } });
  });

  it("voucher recusa pedido de venda, pedido de outro evento e outra escola", async () => {
    const [c] = await service.emitir("event-1", lote(["inv-1"]), ator);
    db.state.pedidos.push({ id: "pedido-venda", eventId: "event-1", sessionId: "session-1", origin: "VENDA", status: "CONFIRMADO" });
    db.state.eventos.push({ id: "event-2", schoolId: "escola-1", status: "RASCUNHO" });

    await expect(service.obterVoucher("event-1", "pedido-venda", ator)).rejects.toMatchObject({ status: 404, response: { code: "CORTESIA_NOT_FOUND" } });
    await expect(service.obterVoucher("event-2", c!.orderId, ator)).rejects.toMatchObject({ status: 404, response: { code: "CORTESIA_NOT_FOUND" } });
    await expect(service.obterVoucher("event-1", c!.orderId, { ...ator, schoolId: "escola-2" })).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
  });
});

describe("EventosCortesiasService.obterMapaAdmin", () => {
  let db: FakeCortesiasDb;
  let service: EventosCortesiasService;

  beforeEach(() => {
    db = new FakeCortesiasDb();
    service = new EventosCortesiasService({ db } as any);
  });

  it("mapa admin funciona com evento em rascunho e marca a cortesia como vendida", async () => {
    await service.emitir("event-1", lote(["inv-1"]), ator);
    db.state.mapas[0]!.layout = {
      largura: 800,
      altura: 600,
      rotulos: [{ fileira: "A", x: 10, y: 20 }, { fileira: "Z", x: 10, y: 500 }],
      elementos: [{ tipo: "PALCO", texto: "Palco", x: 400, y: 10 }],
    };

    const mapa = await service.obterMapaAdmin("event-1", "session-1", ator);

    expect(mapa.sessionId).toBe("session-1");
    expect(mapa.mapId).toBe("map-1");
    const estados = Object.fromEntries(mapa.seats.map((seat) => [seat.id, seat.state]));
    expect(estados).toEqual({ "seat-1": "sold", "seat-2": "available", "seat-3": "available" });
    expect(mapa.inventarioPorAssento).toEqual({ "seat-1": "inv-1", "seat-2": "inv-2", "seat-3": "inv-3" });
    expect(mapa.seats.every((seat) => !("inventorySeatId" in seat) && !("inventoryStatus" in seat))).toBe(true);
    expect(mapa.layout).toEqual({ largura: 800, altura: 600, rotulos: [{ fileira: "A", x: 10, y: 20 }], elementos: [{ tipo: "PALCO", texto: "Palco", x: 400, y: 10 }] });
  });

  it("mapa admin recusa mapa não confirmado e sessão de outro evento", async () => {
    await expect(service.obterMapaAdmin("event-1", "session-outro-evento", ator)).rejects.toMatchObject({ status: 404, response: { code: "SESSION_NOT_FOUND" } });
    await expect(service.obterMapaAdmin("event-1", "session-x", ator)).rejects.toMatchObject({ status: 404, response: { code: "SESSION_NOT_FOUND" } });

    db.state.mapas[0]!.status = "EM_REVISAO";
    await expect(service.obterMapaAdmin("event-1", "session-1", ator)).rejects.toMatchObject({ status: 409, response: { code: "MAP_NOT_CONFIRMED" } });

    db.state.mapas[0]!.status = "CONFIRMADO";
    db.state.sessoes[0]!.mapId = null;
    await expect(service.obterMapaAdmin("event-1", "session-1", ator)).rejects.toMatchObject({ status: 409, response: { code: "MAP_NOT_CONFIRMED" } });
  });

  it("mapa admin recusa evento de outra escola e evento inexistente", async () => {
    await expect(service.obterMapaAdmin("event-1", "session-1", { ...ator, schoolId: "escola-2" })).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
    await expect(service.obterMapaAdmin("event-x", "session-1", ator)).rejects.toMatchObject({ status: 404, response: { code: "EVENT_NOT_FOUND" } });
  });
});

// ---------------------------------------------------------------------------
// Banco falso em memória. Entende o shim de `@essencia/db` usado nos testes:
// colunas são `{ __table, __column }` e operadores são `{ name, args }`.
// Operador desconhecido lança erro, para não filtrar errado em silêncio.
// ---------------------------------------------------------------------------

type Linha = Record<string, any>;
type Estado = Record<string, Linha[]>;

const CHAVE_DO_ESTADO: Record<string, string> = {
  eventos: "eventos",
  eventoSessoes: "sessoes",
  eventoMapas: "mapas",
  eventoMapaAssentos: "assentos",
  eventoInventarioAssentos: "inventarios",
  eventoTiposIngresso: "tipos",
  eventoPedidos: "pedidos",
  eventoParticipantes: "participantes",
  eventoItensPedido: "itens",
  eventoIngressos: "ingressos",
  eventoOperacoesAdministrativas: "operacoes",
  eventoAuditorias: "auditorias",
  eventoPagamentos: "pagamentos",
  eventoLocais: "locais",
  users: "usuarios",
};

function nomeDaTabela(tabela: any): string {
  const nome = tabela?.qualquerColuna?.__table;
  if (!nome || !CHAVE_DO_ESTADO[nome]) throw new Error(`Tabela não suportada no fake: ${String(nome)}`);
  return nome;
}

function ehColuna(valor: any): valor is { __table: string; __column: string } {
  return Boolean(valor) && typeof valor === "object" && typeof valor.__column === "string";
}

function valorDe(argumento: any, linha: Linha): any {
  return ehColuna(argumento) ? linha[argumento.__table]?.[argumento.__column] : argumento;
}

function avaliar(predicado: any, linha: Linha, contexto: FakeCortesiasDb): boolean {
  if (!predicado) return true;
  const argumentos = (predicado.args ?? []).filter((arg: unknown) => arg !== undefined);
  switch (predicado.name) {
    case "and": return argumentos.every((arg: any) => avaliar(arg, linha, contexto));
    case "or": return argumentos.some((arg: any) => avaliar(arg, linha, contexto));
    case "eq": return valorDe(argumentos[0], linha) === valorDe(argumentos[1], linha);
    case "inArray": return (argumentos[1] as unknown[]).includes(valorDe(argumentos[0], linha));
    case "isNull": return valorDe(argumentos[0], linha) == null;
    case "sql": {
      const texto = (predicado.args[0] as string[]).join("?");
      if (texto === "starts_with(?, ?)") {
        if (contexto.ocultarBuscaPorChaveAtiva) return false;
        return String(valorDe(predicado.args[1], linha) ?? "").startsWith(predicado.args[2]);
      }
      throw new Error(`SQL não suportado no fake: ${texto}`);
    }
    default: throw new Error(`Operador não suportado no fake: ${predicado.name}`);
  }
}

function comparar(ordens: any[]) {
  return (a: Linha, b: Linha) => {
    for (const ordem of ordens) {
      if (!["asc", "desc"].includes(ordem?.name)) throw new Error(`Ordenação não suportada no fake: ${ordem?.name}`);
      const va = valorDe(ordem.args[0], a);
      const vb = valorDe(ordem.args[0], b);
      const x = va instanceof Date ? va.getTime() : va;
      const y = vb instanceof Date ? vb.getTime() : vb;
      if (x === y) continue;
      const resultado = x < y ? -1 : 1;
      return ordem.name === "asc" ? resultado : -resultado;
    }
    return 0;
  };
}

function estadoInicial(): Estado {
  return {
    eventos: [{ id: "event-1", schoolId: "escola-1", status: "RASCUNHO" }],
    sessoes: [
      { id: "session-1", eventId: "event-1", mapId: "map-1", locationId: "local-1", status: "RASCUNHO", startsAt: new Date("2026-12-10T19:00:00Z"), endsAt: new Date("2026-12-10T21:00:00Z") },
      { id: "session-2", eventId: "event-1", mapId: "map-1", status: "RASCUNHO", startsAt: new Date("2026-12-11T19:00:00Z") },
      { id: "session-outro-evento", eventId: "event-2", mapId: "map-2", status: "RASCUNHO", startsAt: new Date("2026-12-12T19:00:00Z") },
    ],
    mapas: [{ id: "map-1", eventId: "event-1", status: "CONFIRMADO" }],
    locais: [{ id: "local-1", schoolId: "escola-1", name: "Teatro Municipal" }],
    assentos: [
      { id: "seat-1", mapId: "map-1", rowLabel: "A", seatNumber: "1" },
      { id: "seat-2", mapId: "map-1", rowLabel: "A", seatNumber: "2" },
      { id: "seat-3", mapId: "map-1", rowLabel: "A", seatNumber: "3" },
      { id: "seat-4", mapId: "map-1", rowLabel: "B", seatNumber: "1" },
    ],
    inventarios: [
      { id: "inv-1", sessionId: "session-1", seatId: "seat-1", status: "DISPONIVEL", reservedByOrderId: null },
      { id: "inv-2", sessionId: "session-1", seatId: "seat-2", status: "DISPONIVEL", reservedByOrderId: null },
      { id: "inv-3", sessionId: "session-1", seatId: "seat-3", status: "DISPONIVEL", reservedByOrderId: null },
      { id: "inv-outra", sessionId: "session-2", seatId: "seat-1", status: "DISPONIVEL", reservedByOrderId: null },
    ],
    tipos: [],
    pedidos: [],
    participantes: [],
    itens: [],
    ingressos: [],
    operacoes: [],
    auditorias: [],
    usuarios: [{ id: "user-1", name: "Secretaria Ana" }],
  };
}

class FakeCortesiasDb {
  state: Estado = estadoInicial();
  /** Travas na ordem em que foram pedidas, no formato `modo:id`. */
  lockSequence: string[] = [];
  transacoes = 0;
  /** Próximas inserções que falham, na ordem, por chave do estado. */
  falhasInsercao: Array<{ tabela: string; erro: unknown }> = [];
  /** Faz o UPDATE condicional do inventário não afetar nenhuma linha. */
  updateInventarioSemEfeito = false;
  /** Esconde da próxima transação a busca por chave de idempotência (simula a corrida). */
  ocultarBuscaPorChaveUmaVez = false;
  ocultarBuscaPorChaveAtiva = false;
  private sequencia = 0;

  inventario(id: string): Linha {
    return this.state.inventarios.find((linha) => linha.id === id)!;
  }

  private linhas(nome: string): Linha[] {
    const chave = CHAVE_DO_ESTADO[nome];
    this.state[chave] ??= [];
    return this.state[chave];
  }

  transaction = async <T>(callback: (tx: this) => Promise<T>): Promise<T> => {
    this.transacoes += 1;
    this.ocultarBuscaPorChaveAtiva = this.ocultarBuscaPorChaveUmaVez;
    this.ocultarBuscaPorChaveUmaVez = false;
    const snapshot = structuredClone(this.state);
    try {
      return await callback(this);
    } catch (error) {
      this.state = snapshot;
      throw error;
    } finally {
      this.ocultarBuscaPorChaveAtiva = false;
    }
  };

  select(selecao?: Record<string, any>) {
    const consulta: { base?: string; joins: Array<{ nome: string; on: any; esquerda: boolean }>; where?: any; ordens: any[] } = { joins: [], ordens: [] };
    const executar = (): Linha[] => {
      let combinadas: Linha[] = this.linhas(consulta.base!).map((linha) => ({ [consulta.base!]: linha }));
      for (const join of consulta.joins) {
        combinadas = combinadas.flatMap((combinada) => {
          const pares = this.linhas(join.nome).filter((linha) => avaliar(join.on, { ...combinada, [join.nome]: linha }, this));
          if (pares.length) return pares.map((linha) => ({ ...combinada, [join.nome]: linha }));
          return join.esquerda ? [{ ...combinada, [join.nome]: null }] : [];
        });
      }
      combinadas = combinadas.filter((combinada) => avaliar(consulta.where, combinada, this));
      combinadas.sort(comparar(consulta.ordens));
      if (!selecao) return combinadas.map((combinada) => combinada[consulta.base!]);
      return combinadas.map((combinada) => Object.fromEntries(Object.entries(selecao).map(([chave, tabela]) => [chave, combinada[nomeDaTabela(tabela)]])));
    };
    const cadeia: any = {
      from: (tabela: any) => { consulta.base = nomeDaTabela(tabela); return cadeia; },
      innerJoin: (tabela: any, on: any) => { consulta.joins.push({ nome: nomeDaTabela(tabela), on, esquerda: false }); return cadeia; },
      leftJoin: (tabela: any, on: any) => { consulta.joins.push({ nome: nomeDaTabela(tabela), on, esquerda: true }); return cadeia; },
      where: (predicado: any) => { consulta.where = predicado; return cadeia; },
      orderBy: (...ordens: any[]) => { consulta.ordens = ordens; return cadeia; },
      for: (modo: string) => {
        if (modo !== "update" && modo !== "no key update") throw new Error(`Trava não suportada no fake: ${modo}`);
        if (consulta.joins.length) throw new Error("O fake só trava consultas de uma tabela");
        const linhas = executar();
        linhas.forEach((linha) => this.lockSequence.push(`${modo}:${linha.id}`));
        return Promise.resolve(linhas);
      },
      then: (resolve: (valor: Linha[]) => unknown, reject: (motivo: unknown) => unknown) => Promise.resolve().then(executar).then(resolve, reject),
    };
    return cadeia;
  }

  insert(tabela: any) {
    const nome = nomeDaTabela(tabela);
    const chave = CHAVE_DO_ESTADO[nome];
    let valores: Linha | undefined;
    const executar = async (): Promise<Linha[]> => {
      const indice = this.falhasInsercao.findIndex((falha) => falha.tabela === chave);
      if (indice >= 0) throw this.falhasInsercao.splice(indice, 1)[0].erro;
      this.sequencia += 1;
      const linha = { id: `${chave}-${this.sequencia}`, createdAt: new Date(), ...valores };
      this.linhas(nome).push(linha);
      return [linha];
    };
    const operacao: any = {
      values: (v: Linha) => { valores = v; return operacao; },
      returning: () => executar(),
      then: (resolve: (valor: Linha[]) => unknown, reject: (motivo: unknown) => unknown) => executar().then(resolve, reject),
    };
    return operacao;
  }

  update(tabela: any) {
    const nome = nomeDaTabela(tabela);
    let valores: Linha = {};
    let predicado: any;
    const executar = async (): Promise<Linha[]> => {
      if (nome === "eventoInventarioAssentos" && this.updateInventarioSemEfeito) return [];
      const alvo = this.linhas(nome).filter((linha) => avaliar(predicado, { [nome]: linha }, this));
      alvo.forEach((linha) => Object.assign(linha, valores));
      return alvo;
    };
    const operacao: any = {
      set: (v: Linha) => { valores = v; return operacao; },
      where: (p: any) => { predicado = p; return operacao; },
      returning: () => executar(),
      then: (resolve: (valor: Linha[]) => unknown, reject: (motivo: unknown) => unknown) => executar().then(resolve, reject),
    };
    return operacao;
  }
}
