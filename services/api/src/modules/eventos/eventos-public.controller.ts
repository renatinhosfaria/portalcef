import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";
import { EventosService } from "./eventos.service";
import { EventosPublicSalesService } from "./eventos-public-sales.service";

@Controller("eventos/public")
@Public()
export class EventosPublicController {
  constructor(private readonly service: EventosService, private readonly sales: EventosPublicSalesService) {}
  @Get()
  @Throttle({ strict: { limit: 120, ttl: 60000 } })
  list() { return this.service.listarPublicados(new Date()); }
  @Get("sessoes/:sessionId/map")
  @Throttle({ strict: { limit: 120, ttl: 60000 } })
  map(@Param("sessionId") sessionId: string) { return this.service.getPublicMap(sessionId); }
  @Get(":slug/sessoes")
  @Throttle({ strict: { limit: 120, ttl: 60000 } })
  sessions(@Param("slug") slug: string) { return this.service.listarSessoesPublicas(slug); }
  @Get(":slug")
  @Throttle({ strict: { limit: 120, ttl: 60000 } })
  detail(@Param("slug") slug: string) { return this.service.getPublicBySlug(slug); }
  @Get(":slug/politicas")
  @Throttle({ strict: { limit: 120, ttl: 60000 } })
  politicas(@Param("slug") slug: string) { return this.sales.listarPoliticasPublicas(slug); }
  @Post("reservas")
  @Throttle({ strict: { limit: 20, ttl: 60000 } })
  reservar(@Body() input: any) { return this.sales.reservarAssentos(input); }
  @Post("pedidos/:orderNumber/finalizar")
  @Throttle({ strict: { limit: 20, ttl: 60000 } })
  finalizar(@Param("orderNumber") orderNumber: string, @Body() input: any) { return this.sales.finalizarPedidoConvidado(orderNumber, input); }
  @Post("pedidos/:orderNumber/checkout")
  @Throttle({ strict: { limit: 20, ttl: 60000 } })
  checkout(@Param("orderNumber") orderNumber: string, @Body() input: any) { return this.sales.iniciarCheckout(orderNumber, input); }
  @Get("pedidos/:orderNumber")
  @Throttle({ strict: { limit: 60, ttl: 60000 } })
  consultarPedido(@Param("orderNumber") orderNumber: string) { return this.sales.consultarPedido(orderNumber); }
}
