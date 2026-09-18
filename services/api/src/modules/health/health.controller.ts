import { Controller, Get, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";

import { HealthService } from "./health.service";

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get(["health", "api/health"])
  async check(@Res({ passthrough: true }) response: FastifyReply) {
    const data = await this.healthService.check();
    const healthy = data.status === "ok";
    response.status(healthy ? 200 : 503);

    return {
      success: healthy,
      data,
    };
  }
}
