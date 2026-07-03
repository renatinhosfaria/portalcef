import { Injectable } from "@nestjs/common";

import type { ArquivoWorkflowSalvo, WorkflowUserContext } from "./workflows.types";

@Injectable()
export class WorkflowsAnexosService {
  async registrarUpload(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _arquivo: ArquivoWorkflowSalvo,
  ) {
    return null;
  }

  async remover(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _anexoId: string,
  ) {
    return undefined;
  }
}
