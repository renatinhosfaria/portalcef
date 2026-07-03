import type { WorkflowHistoricoTipo } from "@essencia/db";

export interface WorkflowUserContext {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
}

export interface ArquivoWorkflowUpload {
  buffer: Buffer;
  nomeOriginal: string;
  mimetype: string;
  tamanhoBytes: number;
}

export interface ArquivoWorkflowSalvo {
  url: string;
  storageKey: string;
  nomeOriginal: string;
  mimetype: string;
  tamanhoBytes: number;
}

export interface RegistrarHistoricoParams {
  execucaoId: string;
  tipo: WorkflowHistoricoTipo;
  descricao: string;
  autorId: string;
  motivo?: string | null;
  metadata?: Record<string, unknown> | null;
}
