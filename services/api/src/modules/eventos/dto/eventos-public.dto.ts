import { finalizarPedidoSchema, pagamentoEmbutidoSchema, reservaPublicaSchema } from "@essencia/shared/schemas";
export class ReservaPublicaDto { static schema = reservaPublicaSchema; }
export class FinalizarPedidoDto { static schema = finalizarPedidoSchema; }
export class PagamentoEmbutidoDto { static schema = pagamentoEmbutidoSchema; }
