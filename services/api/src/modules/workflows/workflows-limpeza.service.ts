import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { asc, eq, workflowLimpeza } from "@essencia/db";
import type { Database } from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import { StorageService } from "../../common/storage/storage.service";

const TAMANHO_LOTE = 50;
const INTERVALO_LIMPEZA_MS = 60_000;

type DbTransaction = Parameters<Database["transaction"]>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never;
type DbExecutor = Database | DbTransaction;

@Injectable()
export class WorkflowsLimpezaService {
  private readonly logger = new Logger(WorkflowsLimpezaService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  async enfileirar(
    chaves: readonly string[],
    executor: DbExecutor = this.database.db,
  ): Promise<void> {
    if (chaves.length === 0) return;

    await executor
      .insert(workflowLimpeza)
      .values(
        chaves.map((storageKey) => ({
          storageKey,
          tentativas: 0,
        })),
      )
      .onConflictDoNothing();
  }

  async processarPendentes(): Promise<number> {
    return this.database.db.transaction(async (tx: DbTransaction) => {
      const pendentes = await tx
        .select()
        .from(workflowLimpeza)
        .orderBy(asc(workflowLimpeza.createdAt))
        .limit(TAMANHO_LOTE)
        .for("update", { skipLocked: true });

      let processados = 0;
      for (const pendente of pendentes) {
        try {
          await this.storageService.deleteFileStrict(pendente.storageKey);
          await tx
            .delete(workflowLimpeza)
            .where(eq(workflowLimpeza.id, pendente.id));
          processados += 1;
        } catch (error) {
          const ultimoErro =
            error instanceof Error ? error.message : String(error);
          await tx
            .update(workflowLimpeza)
            .set({
              tentativas: pendente.tentativas + 1,
              ultimoErro,
            })
            .where(eq(workflowLimpeza.id, pendente.id));
          this.logger.warn(
            `Falha ao limpar ${pendente.storageKey} (tentativa ${pendente.tentativas + 1}): ${ultimoErro}`,
          );
        }
      }

      return processados;
    });
  }

  @Interval(INTERVALO_LIMPEZA_MS)
  async processarAgendado(): Promise<void> {
    try {
      await this.processarPendentes();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Falha no processamento da fila de limpeza: ${mensagem}`,
      );
    }
  }
}
