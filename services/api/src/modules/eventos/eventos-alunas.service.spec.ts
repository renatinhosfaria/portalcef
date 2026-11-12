import { eventoIngressos, eventoJuncoesAluna, eventos } from "@essencia/db";
import type { EventoActor } from "@essencia/shared/types";
import { EventosAlunasService } from "./eventos-alunas.service";

const ator: EventoActor = { userId: "user-1", role: "gerente_unidade", schoolId: "escola-1" };

/** Avalia `and`, `eq` e `inArray` do shim de `@essencia/db` contra uma linha simples. */
function casa(predicado: any, linha: Record<string, unknown>): boolean {
  if (!predicado?.name) return true;
  if (predicado.name === "and") return predicado.args.every((item: any) => casa(item, linha));
  const coluna = predicado.args[0]?.__column;
  if (predicado.name === "eq") return predicado.args[1]?.__column ? true : linha[coluna] === predicado.args[1];
  if (predicado.name === "inArray") return (predicado.args[1] as unknown[]).includes(linha[coluna]);
  return true;
}

class FakeAlunasDb {
  eventos = [{ id: "event-1", schoolId: "escola-1" }, { id: "event-2", schoolId: "escola-2" }];
  linhas: any[] = [];
  juncoes: any[] = [];
  travas: string[] = [];
  private sequencia = 0;

  transaction = async (fn: (tx: this) => unknown) => fn(this);

  vender(studentName: string | null, extra: { pedido?: object; ingresso?: object; participante?: object } = {}) {
    const n = ++this.sequencia;
    this.linhas.push({
      ingresso: { numero: `ING${n}`, status: "EMITIDO", ...extra.ingresso },
      participante: { fullName: `Convidado ${n}`, studentName, ...extra.participante },
      pedido: { eventId: "event-1", origin: "VENDA", status: "CONFIRMADO", orderNumber: `PED${n}`, buyerName: `Comprador ${n}`, ...extra.pedido },
      assento: { rowLabel: "A", seatNumber: String(n) },
      sessao: { startsAt: new Date("2026-12-07T19:00:00Z") },
    });
  }

  select() {
    let tabela: any;
    const resolver = (predicado: any) => {
      if (tabela === eventos) return this.eventos.filter((linha) => casa(predicado, linha));
      if (tabela === eventoJuncoesAluna) return this.juncoes.filter((linha) => casa(predicado, linha));
      if (tabela === eventoIngressos) return this.linhas.filter((linha) => casa(predicado, linha.pedido));
      return [];
    };
    const cadeia: any = {
      from: (selecionada: any) => { tabela = selecionada; return cadeia; },
      innerJoin: () => cadeia,
      where: (predicado: any) => {
        const promessa: any = Promise.resolve(resolver(predicado));
        promessa.for = (modo: string) => { this.travas.push(modo); return promessa; };
        return promessa;
      },
    };
    return cadeia;
  }

  insert() {
    return { values: async (payload: any) => { this.juncoes.push(...(Array.isArray(payload) ? payload : [payload]).map((linha) => ({ ...linha }))); } };
  }

  delete() {
    return { where: async (predicado: any) => { this.juncoes = this.juncoes.filter((linha) => !casa(predicado, linha)); } };
  }

  update() {
    return { set: (payload: any) => ({ where: async (predicado: any) => { this.juncoes.filter((linha) => casa(predicado, linha)).forEach((linha) => Object.assign(linha, payload)); } }) };
  }

  mapa() {
    return Object.fromEntries(this.juncoes.map((j) => [j.sourceKey, j.targetKey]));
  }
}

describe("EventosAlunasService", () => {
  let db: FakeAlunasDb;
  let service: EventosAlunasService;

  beforeEach(() => {
    db = new FakeAlunasDb();
    service = new EventosAlunasService({ db } as any);
  });

  describe("listar", () => {
    it("conta por aluna só os ingressos pagos de venda, com os dados para conferência", async () => {
      db.vender("Beatriz Santos");
      db.vender("beatriz santos ");
      db.vender("Carla Lima");
      db.vender(null);

      const r = await service.listar("event-1", ator);

      expect(r.totalPagantes).toBe(4);
      expect(r.semAluna).toBe(1);
      expect(r.alunas.map((a) => [a.chave, a.nome, a.total])).toEqual([["beatriz santos", "Beatriz Santos", 2], ["carla lima", "Carla Lima", 1]]);
      expect(r.alunas[1]!.ingressos).toEqual([{ numero: "ING3", participantName: "Convidado 3", studentName: "Carla Lima", buyerName: "Comprador 3", orderNumber: "PED3", rowLabel: "A", seatNumber: "3", sessionStartsAt: new Date("2026-12-07T19:00:00Z") }]);
    });

    it("deixa de fora cortesias, pedidos não pagos ou desfeitos e ingressos inválidos", async () => {
      db.vender("Ana", { pedido: { origin: "CORTESIA" } });
      for (const status of ["INICIADO", "RESERVADO", "AGUARDANDO_PAGAMENTO", "CANCELADO", "REEMBOLSADO", "EXPIRADO"]) db.vender("Ana", { pedido: { status } });
      for (const status of ["CANCELADO", "REEMITIDO", "REVOGADO"]) db.vender("Ana", { ingresso: { status } });
      db.vender("Ana", { pedido: { eventId: "event-2" } });
      db.vender("Ana", { pedido: { status: "USADO" }, ingresso: { status: "USADO" } });
      db.vender("Ana", { pedido: { status: "NO_SHOW" } });

      const r = await service.listar("event-1", ator);

      expect(r.totalPagantes).toBe(2);
      expect(r.alunas).toEqual([expect.objectContaining({ chave: "ana", total: 2 })]);
    });

    it("soma as grafias juntadas pela escola", async () => {
      db.vender("Beatriz Oliveira");
      db.vender("Beatriz O. Santos");
      db.vender("Beatriz Oliveira Santos");
      db.juncoes.push({ eventId: "event-1", sourceKey: "beatriz oliveira", targetKey: "beatriz oliveira santos" }, { eventId: "event-2", sourceKey: "beatriz o. santos", targetKey: "beatriz oliveira santos" });

      const r = await service.listar("event-1", ator);

      expect(r.alunas.map((a) => [a.chave, a.total])).toEqual([["beatriz oliveira santos", 2], ["beatriz o. santos", 1]]);
      expect(r.alunas[0]!.grafias.map((g) => [g.chave, g.juntada])).toEqual([["beatriz oliveira", true], ["beatriz oliveira santos", false]]);
    });

    it("recusa evento inexistente e evento de outra escola", async () => {
      await expect(service.listar("nao-existe", ator)).rejects.toMatchObject({ response: { code: "EVENT_NOT_FOUND" } });
      await expect(service.listar("event-2", ator)).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
    });
  });

  describe("juntar", () => {
    it("grava uma junção por grafia de origem, normalizando os nomes, e devolve a contagem nova", async () => {
      db.vender("Beatriz Oliveira");
      db.vender("Beatriz O. Santos");
      db.vender("Beatriz Oliveira Santos");

      const r = await service.juntar("event-1", { destino: " Beatriz Oliveira SANTOS ", origens: ["Beatriz Oliveira", "beatriz o. santos", "Beatriz Oliveira Santos"] }, ator);

      expect(db.mapa()).toEqual({ "beatriz oliveira": "beatriz oliveira santos", "beatriz o. santos": "beatriz oliveira santos" });
      expect(db.juncoes.every((j) => j.eventId === "event-1" && j.createdBy === "user-1")).toBe(true);
      expect(r.alunas).toEqual([expect.objectContaining({ chave: "beatriz oliveira santos", total: 3 })]);
      expect(db.travas).toEqual(["no key update"]);
    });

    it("reaponta para o novo destino o que já estava juntado às origens", async () => {
      db.juncoes.push({ eventId: "event-1", sourceKey: "bia", targetKey: "beatriz" }, { eventId: "event-2", sourceKey: "bia", targetKey: "beatriz" });

      await service.juntar("event-1", { destino: "Beatriz Santos", origens: ["Beatriz"] }, ator);

      expect(db.juncoes.filter((j) => j.eventId === "event-1").map((j) => [j.sourceKey, j.targetKey]).sort()).toEqual([["beatriz", "beatriz santos"], ["bia", "beatriz santos"]]);
      expect(db.juncoes.find((j) => j.eventId === "event-2")).toMatchObject({ sourceKey: "bia", targetKey: "beatriz" });
    });

    it("inverter uma junção não cria ciclo", async () => {
      db.juncoes.push({ eventId: "event-1", sourceKey: "bia", targetKey: "beatriz" });

      await service.juntar("event-1", { destino: "Bia", origens: ["Beatriz"] }, ator);

      expect(db.mapa()).toEqual({ beatriz: "bia" });
    });

    it("repetir a mesma junção não duplica linhas", async () => {
      const entrada = { destino: "Beatriz Santos", origens: ["Bia"] };
      await service.juntar("event-1", entrada, ator);
      await service.juntar("event-1", entrada, ator);

      expect(db.juncoes).toHaveLength(1);
    });

    it("recusa quando não sobra nenhuma grafia diferente do destino", async () => {
      await expect(service.juntar("event-1", { destino: "Beatriz", origens: [" beatriz "] }, ator)).rejects.toMatchObject({ status: 400, response: { code: "VALIDATION_ERROR" } });
      expect(db.juncoes).toHaveLength(0);
    });

    it("recusa evento de outra escola sem gravar", async () => {
      await expect(service.juntar("event-2", { destino: "Beatriz", origens: ["Bia"] }, ator)).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
      expect(db.juncoes).toHaveLength(0);
    });
  });

  describe("separar", () => {
    it("desfaz só a junção da grafia pedida, no evento certo", async () => {
      db.vender("Bia");
      db.vender("Beatriz");
      db.juncoes.push({ eventId: "event-1", sourceKey: "bia", targetKey: "beatriz" }, { eventId: "event-1", sourceKey: "bea", targetKey: "beatriz" }, { eventId: "event-2", sourceKey: "bia", targetKey: "beatriz" });

      const r = await service.separar("event-1", { chave: " BIA " }, ator);

      expect(db.juncoes.map((j) => [j.eventId, j.sourceKey])).toEqual([["event-1", "bea"], ["event-2", "bia"]]);
      expect(r.alunas.map((a) => a.chave).sort()).toEqual(["beatriz", "bia"]);
    });

    it("recusa evento de outra escola", async () => {
      db.juncoes.push({ eventId: "event-2", sourceKey: "bia", targetKey: "beatriz" });
      await expect(service.separar("event-2", { chave: "bia" }, ator)).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
      expect(db.juncoes).toHaveLength(1);
    });
  });
});
