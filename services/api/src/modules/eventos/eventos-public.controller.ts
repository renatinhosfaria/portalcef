import { Controller, Get, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";
import { EventosService } from "./eventos.service";

@Controller("eventos/public")
@Public()
export class EventosPublicController {
  constructor(private readonly service: EventosService) {}
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
}
