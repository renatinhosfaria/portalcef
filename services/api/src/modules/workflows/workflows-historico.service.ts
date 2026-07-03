import { Injectable } from "@nestjs/common";

import type { RegistrarHistoricoParams } from "./workflows.types";

@Injectable()
export class WorkflowsHistoricoService {
  async registrar(_params: RegistrarHistoricoParams) {
    return undefined;
  }
}
