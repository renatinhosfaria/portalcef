import { BadRequestException } from "@nestjs/common";
import {
  and,
  asc,
  eq,
  inArray,
  eventoCheckins,
  eventoIngressos,
  eventoOperacoesAdministrativas,
  eventoPedidos,
  eventoSessoes,
  type Database,
} from "@essencia/db";

export type TipoTrava =
  | "LIVRE"
  | "VENDA_CONFIRMADA"
  | "COMPRA_EM_ANDAMENTO"
  | "OPERACAO_ATIVA";

export const MENSAGEM_TRAVA: Record<Exclude<TipoTrava, "LIVRE">, string> = {
  VENDA_CONFIRMADA:
    "Bloqueado: já há lugares vendidos com pagamento confirmado neste evento.",
  COMPRA_EM_ANDAMENTO:
    "Há uma compra em andamento neste evento. Tente de novo em alguns minutos.",
  OPERACAO_ATIVA:
    "Há uma operação administrativa ativa (bloqueio, cortesia ou reserva) neste evento. Cancele-a antes de mudar o mapa.",
};

export const STATUS_PEDIDO_PAGO = [
  "CONFIRMADO",
  "USADO",
  "NO_SHOW",
  "REEMBOLSADO",
] as const;

export const STATUS_PEDIDO_ABERTO = [
  "INICIADO",
  "RESERVADO",
  "AGUARDANDO_PAGAMENTO",
] as const;

type DadosTrava = {
  pedidos: Array<{ status: string; expiresAt: Date | null }>;
  ingressos: number;
  checkins: number;
  operacoesAtivas: number;
};

export function classificarTrava(dados: DadosTrava, agora: Date): TipoTrava {
  const possuiVenda = dados.pedidos.some(({ status }) =>
    (STATUS_PEDIDO_PAGO as readonly string[]).includes(status),
  );

  if (possuiVenda || dados.ingressos > 0 || dados.checkins > 0) {
    return "VENDA_CONFIRMADA";
  }

  if (dados.operacoesAtivas > 0) {
    return "OPERACAO_ATIVA";
  }

  const possuiCompraEmAndamento = dados.pedidos.some(
    ({ status, expiresAt }) =>
      (STATUS_PEDIDO_ABERTO as readonly string[]).includes(status) &&
      expiresAt !== null &&
      expiresAt.getTime() > agora.getTime(),
  );

  return possuiCompraEmAndamento ? "COMPRA_EM_ANDAMENTO" : "LIVRE";
}

type LockRows = <T>(query: unknown) => Promise<T[]>;

export async function carregarTrava(
  db: Database,
  eventId: string,
  agora: Date,
  lockRows?: LockRows,
): Promise<TipoTrava> {
  const sessoes = (await db
    .select({ id: eventoSessoes.id })
    .from(eventoSessoes)
    .where(eq(eventoSessoes.eventId, eventId))) as Array<{ id: string }>;
  const sessionIds = sessoes.map(({ id }) => id);

  const pedidosBaseQuery = db
    .select()
    .from(eventoPedidos)
    .where(eq(eventoPedidos.eventId, eventId));
  const pedidosQuery = typeof (pedidosBaseQuery as any).orderBy === "function"
    ? (pedidosBaseQuery as any).orderBy(asc(eventoPedidos.id))
    : pedidosBaseQuery;
  const pedidos = lockRows
    ? await lockRows<any>(pedidosQuery)
    : ((await pedidosQuery) as Array<{ status: string; expiresAt: Date | null }>);

  const ingressos = sessionIds.length
    ? await db
        .select({ id: eventoIngressos.id })
        .from(eventoIngressos)
        .where(inArray(eventoIngressos.sessionId, sessionIds))
    : [];
  const checkins = sessionIds.length
    ? await db
        .select({ id: eventoCheckins.id })
        .from(eventoCheckins)
        .where(inArray(eventoCheckins.sessionId, sessionIds))
    : [];
  const operacoes = await db
    .select({ id: eventoOperacoesAdministrativas.id })
    .from(eventoOperacoesAdministrativas)
    .where(
      and(
        eq(eventoOperacoesAdministrativas.eventId, eventId),
        eq(eventoOperacoesAdministrativas.status, "ATIVA"),
      ),
    );

  return classificarTrava(
    {
      pedidos,
      ingressos: ingressos.length,
      checkins: checkins.length,
      operacoesAtivas: operacoes.length,
    },
    agora,
  );
}

export function exigirMapaLivre(tipo: TipoTrava): void {
  if (tipo === "LIVRE") return;

  throw new BadRequestException({
    code: tipo,
    message: MENSAGEM_TRAVA[tipo],
  });
}
