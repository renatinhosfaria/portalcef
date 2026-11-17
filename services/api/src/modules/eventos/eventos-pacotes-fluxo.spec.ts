import { eventoAceites, eventoIngressos, eventoInventarioAssentos, eventoItensPedido, eventoParticipantes, eventoPedidos, eventoReservas, eventoTiposIngresso } from "@essencia/db";
import { EventosConfirmacaoService } from "./eventos-confirmacao.service";
import { EventosPublicSalesService } from "./eventos-public-sales.service";
import { montarIngressosDoPedido } from "./montar-pedido-ingressos";
import { criarBancoFluxoPacotes, uuidPacoteTeste } from "./eventos-pacotes-fluxo.spec-helper";

describe("fluxo integrado de pacotes por assento", () => {
  const segredoAnterior = process.env.EVENTOS_QR_SECRET;
  beforeAll(() => { process.env.EVENTOS_QR_SECRET = "segredo-ficticio-de-teste"; });
  afterAll(() => { if (segredoAnterior === undefined) delete process.env.EVENTOS_QR_SECRET; else process.env.EVENTOS_QR_SECRET = segredoAnterior; });

  it.each([[10, false, 38000], [30, true, 102600]] as const)("reserva, finaliza e emite %s ingressos individuais", async (quantidade, cupom, total) => {
    const { db, ler, idSessao, idTipo, tiposPolitica } = criarBancoFluxoPacotes(quantidade);
    const vendas = new EventosPublicSalesService({ db } as any);
    const seats = Array.from({ length: quantidade }, (_, i) => ({ seatId: uuidPacoteTeste(100+i), ticketTypeId: idTipo, participantIndex: i, pacoteId: uuidPacoteTeste(800+Math.floor(i/10)) }));
    const reserva = await vendas.reservarAssentos({ sessionId: idSessao, seats, idempotencyKey: `reserva-integrada-${quantidade}` });
    expect(reserva.totalCents).toBe(quantidade === 10 ? 38000 : 114000);
    expect(ler(eventoReservas)).toHaveLength(quantidade);
    Object.assign(ler(eventoTiposIngresso)[0]!, { priceCents: 300000, lugaresPorPacote: 30, name: "Nome alterado" });
    if (cupom) expect((await vendas.aplicarCupom(reserva.orderNumber, { code: "DEZ" })).totalCents).toBe(102600);
    const finalizacao = await vendas.finalizarPedidoConvidado(reserva.orderNumber, {
      buyer: { name: "Comprador Teste", email: "teste@example.com", phone: "11999999999" },
      participants: seats.map((_, i) => ({ participantIndex: i, fullName: `Pessoa Teste ${i}`, studentName: "Aluna Teste", type: "CONVIDADO" })),
      acceptances: tiposPolitica.map(type => ({ type, version: 1 })),
      idempotencyKey: `finalizacao-integrada-${quantidade}`,
    });
    expect(finalizacao.pedido.totalCents).toBe(total);
    expect(ler(eventoAceites)).toHaveLength(5);
    expect(ler(eventoParticipantes)).toHaveLength(quantidade);
    const pedido = ler(eventoPedidos)[0]!;
    const confirmacao = new EventosConfirmacaoService();
    await db.transaction((tx: any) => confirmacao.confirmarPedido(pedido.id, "STRIPE", tx));
    await db.transaction((tx: any) => confirmacao.confirmarPedido(pedido.id, "STRIPE", tx));
    const emitidos = ler(eventoIngressos);
    expect(emitidos).toHaveLength(quantidade);
    expect(new Set(emitidos.map(i => i.qrPayload)).size).toBe(quantidade);
    expect(new Set(emitidos.map(i => i.itemId)).size).toBe(quantidade);
    expect(ler(eventoInventarioAssentos).every(i => i.status === "VENDIDO")).toBe(true);
    const ingressos = await montarIngressosDoPedido(db, pedido.id);
    expect(ingressos).toHaveLength(quantidade);
    expect(new Set(ingressos.map(i => i.participantName))).toEqual(new Set(seats.map((_, i) => `Pessoa Teste ${i}`)));
    expect(ingressos.every(i => i.ticketTypeName === "Combo 10")).toBe(true);
    emitidos[0]!.status = "USADO";
    const depois = await montarIngressosDoPedido(db, pedido.id);
    expect(depois.filter(i => i.status === "USADO")).toHaveLength(1);
    expect(depois.filter(i => i.status === "EMITIDO")).toHaveLength(quantidade-1);
    expect((await vendas.consultarPedido(reserva.orderNumber)).items).toHaveLength(quantidade);
  });

  it("reverte o pedido inteiro se falhar no meio da reserva do pacote", async () => {
    const { db, ler, idSessao, idTipo } = criarBancoFluxoPacotes(10, 2);
    await expect(new EventosPublicSalesService({ db } as any).reservarAssentos({ sessionId: idSessao, seats: Array.from({ length: 10 }, (_, i) => ({ seatId: uuidPacoteTeste(100+i), ticketTypeId: idTipo, participantIndex: i, pacoteId: uuidPacoteTeste(800) })), idempotencyKey: "reserva-com-falha-integrada" })).rejects.toThrow("Falha simulada");
    expect(ler(eventoPedidos)).toHaveLength(0);
    expect(ler(eventoItensPedido)).toHaveLength(0);
    expect(ler(eventoReservas)).toHaveLength(0);
    expect(ler(eventoInventarioAssentos).every(i => i.status === "DISPONIVEL")).toBe(true);
  });
});
