import { Injectable } from "@nestjs/common";
import { workflowHistorico } from "@essencia/db";
import type { Database } from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import type { RegistrarHistoricoParams } from "./workflows.types";

type HistoricoExecutor = Pick<Database, "insert">;

@Injectable()
export class WorkflowsHistoricoService {
  constructor(private readonly database: DatabaseService) {}

  async registrar(
    params: RegistrarHistoricoParams,
    executor: HistoricoExecutor = this.database.db,
  ) {
    await executor.insert(workflowHistorico).values({
      execucaoId: params.execucaoId,
      tipo: params.tipo,
      descricao: params.descricao,
      motivo: params.motivo ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      autorId: params.autorId,
    });
  }
}
