import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionService } from "../auth/session.service";
import { StatsService } from "./stats.service";

@Controller("stats")
@UseGuards(AuthGuard, RolesGuard)
export class StatsController {
  constructor(
    private statsService: StatsService,
    private sessionService: SessionService,
  ) {}

  @Get("/dashboard")
  async getDashboard(@Req() req: FastifyRequest) {
    const headers = req.headers as Record<string, unknown>;
    const forwarded = headers["x-forwarded-for"] as string | undefined;
    const ip =
      (forwarded ? forwarded.split(",")[0]?.trim() : undefined) ||
      (req.ip as string) ||
      (req.socket?.remoteAddress as string) ||
      "unknown";

    // Allow 5 requests per 15 seconds per IP
    const { allowed } = await this.sessionService.rateLimit(
      `ratelimit:stats:${ip}`,
      15,
      5,
    );
    if (!allowed)
      throw new HttpException(
        "Too many requests to /stats/dashboard",
        HttpStatus.TOO_MANY_REQUESTS,
      );

    const data = await this.statsService.getDashboard();
    return { success: true, data };
  }

  @Get("/master-overview")
  @Roles("master")
  async getMasterOverview() {
    const data = await this.statsService.getMasterOverview();
    return { success: true, data };
  }
}
