import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  and,
  eq,
  eventoIngressos,
  eventoInventarioAssentos,
  eventoJuncoesAluna,
  eventoMapaAssentos,
  eventoParticipantes,
  eventoPedidos,
  eventoSessoes,
  eventos,
  inArray,
  type Database,
} from "@essencia/db";
import { agruparPorAluna, chaveAluna } from "@essencia/shared/eventos/alunas";
import type { JuntarAlunasInput, SepararAlunaInput } from "@essencia/shared/schemas";
import type { ConvidadosPorAluna, EventoActor, IngressoDaAluna } from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";
import { assertSchoolScope } from "./eventos.service";

/** Pedido pago e não desfeito: é o que conta como convidado pagante. */
const PEDIDOS_PAGOS = new Set(["CONFIRMADO", "USADO", "NO_SHOW"]);
/** Ingresso válido; os reemitidos ficam de fora porque o substituto já conta. */
const INGRESSOS_VALIDOS = new Set(["EMITIDO", "USADO"]);

@Injectable()
export class EventosAlunasService {
  constructor(private readonly database: DatabaseService) {}

  private get db(): Database {
    return this.database.db;
  }

  async listar(eventId: string, actor: EventoActor): Promise<ConvidadosPorAluna> {
    await this.carregarEvento(this.db, eventId, actor);
    return this.contar(this.db, eventId);
  }

  /** Passa a contar as grafias de `origens` como a mesma aluna de `destino`. */
  async juntar(eventId: string, input: JuntarAlunasInput, actor: EventoActor): Promise<ConvidadosPorAluna> {
    const destino = chaveAluna(input.destino);
    const origens = [...new Set(input.origens.map(chaveAluna))].filter((chave) => chave && chave !== destino);
    if (!destino || !origens.length) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Escolha ao menos dois nomes diferentes para juntar" });
    }
    return this.db.transaction(async (tx: any) => {
      // A trava do evento serializa junções simultâneas, que poderiam formar um ciclo.
      await this.carregarEvento(tx, eventId, actor, true);
      const doEvento = eq(eventoJuncoesAluna.eventId, eventId);
      // O destino vira raiz e as origens são regravadas: nenhuma chave fica com dois destinos.
      await tx.delete(eventoJuncoesAluna).where(and(doEvento, inArray(eventoJuncoesAluna.sourceKey, [destino, ...origens])));
      // O que já estava juntado a uma das origens acompanha o novo destino.
      await tx.update(eventoJuncoesAluna).set({ targetKey: destino, updatedAt: new Date() }).where(and(doEvento, inArray(eventoJuncoesAluna.targetKey, origens)));
      await tx.insert(eventoJuncoesAluna).values(origens.map((sourceKey) => ({ eventId, sourceKey, targetKey: destino, createdBy: actor.userId })));
      return this.contar(tx, eventId);
    });
  }

  /** Desfaz a junção de uma grafia: ela volta a contar sozinha. */
  async separar(eventId: string, input: SepararAlunaInput, actor: EventoActor): Promise<ConvidadosPorAluna> {
    await this.carregarEvento(this.db, eventId, actor);
    await this.db.delete(eventoJuncoesAluna).where(and(eq(eventoJuncoesAluna.eventId, eventId), eq(eventoJuncoesAluna.sourceKey, chaveAluna(input.chave))));
    return this.contar(this.db, eventId);
  }

  private async carregarEvento(db: any, eventId: string, actor: EventoActor, travar = false): Promise<void> {
    const consulta = db.select().from(eventos).where(eq(eventos.id, eventId));
    const [event] = await (travar ? consulta.for("no key update") : consulta);
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Evento não encontrado" });
    assertSchoolScope(actor, event.schoolId);
  }

  private async contar(db: any, eventId: string): Promise<ConvidadosPorAluna> {
    const linhas: any[] = await db
      .select({ ingresso: eventoIngressos, participante: eventoParticipantes, pedido: eventoPedidos, assento: eventoMapaAssentos, sessao: eventoSessoes })
      .from(eventoIngressos)
      .innerJoin(eventoPedidos, eq(eventoPedidos.id, eventoIngressos.orderId))
      .innerJoin(eventoParticipantes, eq(eventoParticipantes.id, eventoIngressos.participantId))
      .innerJoin(eventoInventarioAssentos, eq(eventoInventarioAssentos.id, eventoIngressos.inventorySeatId))
      .innerJoin(eventoMapaAssentos, eq(eventoMapaAssentos.id, eventoInventarioAssentos.seatId))
      .innerJoin(eventoSessoes, eq(eventoSessoes.id, eventoIngressos.sessionId))
      .where(and(eq(eventoPedidos.eventId, eventId), eq(eventoPedidos.origin, "VENDA")));
    const pagantes: IngressoDaAluna[] = linhas
      .filter(({ pedido, ingresso }) => PEDIDOS_PAGOS.has(pedido.status) && INGRESSOS_VALIDOS.has(ingresso.status))
      .map(({ ingresso, participante, pedido, assento, sessao }) => ({
        numero: ingresso.numero,
        participantName: participante.fullName,
        studentName: participante.studentName ?? "",
        buyerName: pedido.buyerName ?? "",
        orderNumber: pedido.orderNumber,
        rowLabel: assento.rowLabel,
        seatNumber: assento.seatNumber,
        sessionStartsAt: sessao.startsAt,
      }));
    const juncoes = await db.select().from(eventoJuncoesAluna).where(eq(eventoJuncoesAluna.eventId, eventId));
    const { alunas, semAluna } = agruparPorAluna(pagantes, juncoes);
    return {
      alunas: alunas.map(({ itens, ...aluna }) => ({ ...aluna, ingressos: itens })),
      semAluna,
      totalPagantes: pagantes.length,
    };
  }
}
