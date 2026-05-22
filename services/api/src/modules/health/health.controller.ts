import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get(["health", "api/health"])
  check() {
    return {
      success: true,
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
    };
  }
}
