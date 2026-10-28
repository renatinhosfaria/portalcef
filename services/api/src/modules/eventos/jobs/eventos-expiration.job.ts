import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventosPublicSalesService } from "../eventos-public-sales.service";

@Injectable()
export class EventosExpirationJob {
  constructor(private readonly sales: EventosPublicSalesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async liberarExpirados(now = new Date()): Promise<number> {
    return this.sales.liberarReservasExpiradas(now);
  }
}
