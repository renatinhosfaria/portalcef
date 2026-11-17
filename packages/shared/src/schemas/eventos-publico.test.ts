import { describe, expect, it } from "vitest";

import { criarEventoSchema, tipoIngressoAdminSchema, finalizarPedidoSchema, meusIngressosSchema, pagamentoEmbutidoSchema, reservaPublicaSchema } from "./eventos";

describe("schemas públicos de eventos", () => {
  it("aceita consulta de ingressos por pedido e e-mail", () => {
    expect(meusIngressosSchema.safeParse({ orderNumber: "PED123", email: "cliente@example.com" }).success).toBe(true);
  });

  it("aceita consulta de ingressos por e-mail e telefone", () => {
    expect(meusIngressosSchema.safeParse({ email: "cliente@example.com", phone: "11999999999" }).success).toBe(true);
  });

  it("recusa consulta de ingressos sem identificador suficiente", () => {
    expect(meusIngressosSchema.safeParse({ orderNumber: "PED123" }).success).toBe(false);
  });

  it("recusa pagamento embutido com URL HTTP", () => {
    expect(pagamentoEmbutidoSchema.safeParse({ returnUrl: "http://portalcef.com.br/pagamento", idempotencyKey: "chave-1234" }).success).toBe(false);
  });

  it("recusa campos extras no pagamento embutido", () => {
    expect(pagamentoEmbutidoSchema.safeParse({ returnUrl: "https://portalcef.com.br/pagamento", idempotencyKey: "chave-1234", extra: true }).success).toBe(false);
  });

  it("aceita reserva sem comprador", () => {
    expect(reservaPublicaSchema.safeParse({
      sessionId: "00000000-0000-4000-8000-000000000001",
      seats: [{ seatId: "00000000-0000-4000-8000-000000000002", ticketTypeId: "00000000-0000-4000-8000-000000000003", participantIndex: 0 }],
      idempotencyKey: "reserva-123456",
    }).success).toBe(true);
  });

  it("recusa finalização sem comprador", () => {
    expect(finalizarPedidoSchema.safeParse({
      participants: [{ participantIndex: 0, fullName: "Ana", type: "CONVIDADO" }],
      acceptances: ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"].map((type) => ({ type, version: 1 })),
      idempotencyKey: "final-123456",
    }).success).toBe(false);
  });

  it("exige a aluna que convidou em cada participante", () => {
    const base = {
      buyer: { name: "Ana Maria", email: "ana@example.com", phone: "11999999999" },
      acceptances: ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"].map((type) => ({ type, version: 1 })),
      idempotencyKey: "final-123456",
    };
    const participante = (studentName?: unknown) => ({ participantIndex: 0, fullName: "Ana", type: "CONVIDADO", ...(studentName === undefined ? {} : { studentName }) });

    const preenchido = finalizarPedidoSchema.parse({ ...base, participants: [participante("  Beatriz Santos ")] });
    expect(preenchido.participants[0]?.studentName).toBe("Beatriz Santos");
    expect(finalizarPedidoSchema.safeParse({ ...base, participants: [participante()] }).success).toBe(false);
    expect(finalizarPedidoSchema.safeParse({ ...base, participants: [participante("   ")] }).success).toBe(false);
    expect(finalizarPedidoSchema.safeParse({ ...base, participants: [participante("B")] }).success).toBe(false);
    expect(finalizarPedidoSchema.safeParse({ ...base, participants: [participante("a".repeat(201))] }).success).toBe(false);
  });
});


describe("pacotes e pedidos sem teto global", () => {
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  it("aceita reserva e finalização com trinta assentos", () => {
    expect(reservaPublicaSchema.safeParse({sessionId: uuid(1), seats: Array.from({length:30}, (_,i) => ({seatId: uuid(i+10), ticketTypeId: uuid(2), participantIndex:i, pacoteId:uuid(3)})), idempotencyKey:"reserva-grande-123"}).success).toBe(true);
    expect(finalizarPedidoSchema.safeParse({buyer:{name:"Pessoa Teste",email:"teste@example.com",phone:"11999999999"},participants:Array.from({length:30},(_,i)=>({participantIndex:i,fullName:"Pessoa Teste",studentName:"Aluna Teste",type:"CONVIDADO"})),acceptances:["PRIVACIDADE","COMPRA","CANCELAMENTO_REEMBOLSO","ACESSIBILIDADE","CONTATO"].map(type=>({type,version:1})),idempotencyKey:"finalizacao-grande-123"}).success).toBe(true);
  });
  it("valida quantidade positiva sem teto de vinte e preserva PATCH omisso", () => {
    expect(tipoIngressoAdminSchema.parse({name:"Combo",priceCents:10001,lugaresPorPacote:30}).lugaresPorPacote).toBe(30);
    for(const lugaresPorPacote of [0,-1,1.5,null]) expect(tipoIngressoAdminSchema.safeParse({name:"Combo",priceCents:10001,lugaresPorPacote}).success).toBe(false);
    expect(tipoIngressoAdminSchema.parse({name:"Inteira",priceCents:4500})).not.toHaveProperty("lugaresPorPacote");
    const tipo = criarEventoSchema.shape.ticketTypes.parse([{name:"Inteira",priceCents:4500}])[0];
    expect(tipo?.lugaresPorPacote).toBe(1);
  });
  it("recusa identificador de pacote inválido e campos extras por assento", () => {
    for(const extra of [{pacoteId:"invalido"},{precoPacoteCentavos:1}]) expect(reservaPublicaSchema.safeParse({sessionId:uuid(1),seats:[{seatId:uuid(2),ticketTypeId:uuid(3),participantIndex:0,...extra}],idempotencyKey:"reserva-123456"}).success).toBe(false);
  });
});
