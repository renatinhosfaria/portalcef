import { Injectable } from "@nestjs/common";
import type { PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import { gerarPropostaDePdf } from "./gerar-proposta";

/** Gera a proposta de mapa de assentos a partir da planta em PDF. */
@Injectable()
export class GeradorMapaPdf {
  gerar(buffer: Buffer, pagina?: number): Promise<PropostaMapa> {
    return gerarPropostaDePdf(buffer, pagina);
  }
}
