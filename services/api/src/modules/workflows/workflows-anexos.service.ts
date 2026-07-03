import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, workflowAnexos } from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import { StorageService } from "../../common/storage/storage.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import type {
  ArquivoWorkflowSalvo,
  WorkflowUserContext,
} from "./workflows.types";

@Injectable()
export class WorkflowsAnexosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storageService: StorageService,
    private readonly historicoService: WorkflowsHistoricoService,
  ) {}

  async registrarUpload(
    session: WorkflowUserContext,
    execucaoId: string,
    arquivo: ArquivoWorkflowSalvo,
  ) {
    const [anexo] = await this.database.db
      .insert(workflowAnexos)
      .values({
        execucaoId,
        nomeOriginal: arquivo.nomeOriginal,
        storageKey: arquivo.storageKey,
        url: arquivo.url,
        mimeType: arquivo.mimetype,
        tamanhoBytes: arquivo.tamanhoBytes,
        enviadoPor: session.userId,
      })
      .returning();

    if (!anexo) {
      throw new InternalServerErrorException("Falha ao registrar anexo");
    }

    await this.historicoService.registrar({
      execucaoId,
      tipo: "ANEXO_ENVIADO",
      descricao: "Anexo enviado",
      autorId: session.userId,
      metadata: {
        anexoId: anexo.id,
        nomeOriginal: anexo.nomeOriginal,
      },
    });

    return anexo;
  }

  async remover(
    session: WorkflowUserContext,
    execucaoId: string,
    anexoId: string,
  ) {
    const filtro = and(
      eq(workflowAnexos.id, anexoId),
      eq(workflowAnexos.execucaoId, execucaoId),
    );
    const anexo = await this.database.db.query.workflowAnexos.findFirst({
      where: filtro,
    });

    if (!anexo) {
      throw new NotFoundException("Anexo nao encontrado");
    }

    await this.storageService.deleteFile(anexo.storageKey);
    await this.database.db.delete(workflowAnexos).where(filtro);

    await this.historicoService.registrar({
      execucaoId,
      tipo: "ANEXO_REMOVIDO",
      descricao: "Anexo removido",
      autorId: session.userId,
      metadata: {
        anexoId: anexo.id,
        nomeOriginal: anexo.nomeOriginal,
      },
    });
  }
}
