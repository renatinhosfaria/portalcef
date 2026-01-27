import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
} from "@nestjs/common";

import { extrairResumoRelatorioCsp } from "./csp-report.util";

@Controller("csp-report")
export class CspReportController {
  private readonly logger = new Logger(CspReportController.name);

  @Post()
  @HttpCode(204)
  registrar(@Body() body: unknown, @Headers("user-agent") userAgent?: string) {
    const resumo = extrairResumoRelatorioCsp(body);

    if (resumo) {
      this.logger.warn(
        `Relatorio CSP: ${JSON.stringify({ ...resumo, userAgent })}`,
      );
      return;
    }

    this.logger.warn("Relatorio CSP invalido");
  }
}
