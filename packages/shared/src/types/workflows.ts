export type WorkflowModeloStatus = "RASCUNHO" | "PUBLICADO" | "INATIVO";

export type WorkflowExecucaoStatus =
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "CANCELADA";

export type WorkflowHistoricoTipo =
  | "WORKFLOW_INICIADO"
  | "ETAPA_CONCLUIDA"
  | "ETAPA_PENDENTE"
  | "OBSERVACAO_ETAPA_ALTERADA"
  | "ANEXO_ENVIADO"
  | "ANEXO_REMOVIDO"
  | "TITULO_EXECUCAO_EDITADO"
  | "MODELO_ATUALIZADO"
  | "EXECUCAO_CONCLUIDA"
  | "EXECUCAO_CANCELADA"
  | "EXECUCAO_REABERTA"
  | "EXECUCAO_DESCARTADA";

export interface WorkflowCategoria {
  id: string;
  schoolId: string;
  unitId: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowOrientacao {
  id: string;
  titulo: string;
  conteudo: string;
  ordem: number;
}

export interface WorkflowEtapa {
  id: string;
  titulo: string;
  instrucao: string | null;
  ordem: number;
  versao: number;
  updatedAt: string;
}

export interface WorkflowFase {
  id: string;
  nome: string;
  ordem: number;
  etapas: WorkflowEtapa[];
}

export interface WorkflowModeloResumo {
  id: string;
  schoolId: string;
  unitId: string;
  categoriaId: string;
  nome: string;
  descricaoCurta: string;
  status: WorkflowModeloStatus;
  criadoPor: string;
  createdAt: string;
  updatedAt: string;
  categoria: WorkflowCategoria;
}

export interface WorkflowModeloDetalhe extends WorkflowModeloResumo {
  orientacoes: WorkflowOrientacao[];
  fases: WorkflowFase[];
}

export interface WorkflowEtapaProgresso {
  etapaId: string;
  concluida: boolean;
  observacao: string | null;
  concluidaPor: string | null;
  concluidaAt: string | null;
  etapaVersao: number;
}

export interface WorkflowAnexo {
  id: string;
  nomeOriginal: string;
  storageKey: string;
  url: string;
  mimeType: string;
  tamanhoBytes: number;
  enviadoPor: string;
  enviadoPorNome: string | null;
  createdAt: string;
}

export interface WorkflowHistoricoItem {
  id: string;
  tipo: WorkflowHistoricoTipo;
  descricao: string;
  motivo: string | null;
  autorId: string;
  autorNome: string | null;
  createdAt: string;
}

export interface WorkflowExecucaoResumo {
  id: string;
  schoolId: string;
  unitId: string;
  modeloId: string;
  titulo: string;
  status: WorkflowExecucaoStatus;
  teste: boolean;
  modeloAtualizado: boolean;
  iniciadoPor: string;
  concluidoAt: string | null;
  canceladoAt: string | null;
  motivoCancelamento: string | null;
  createdAt: string;
  updatedAt: string;
  modelo: WorkflowModeloResumo;
  faseAtual: string | null;
  progressoPercentual: number;
}

export interface WorkflowExecucaoDetalhe extends WorkflowExecucaoResumo {
  modelo: WorkflowModeloDetalhe;
  progresso: WorkflowEtapaProgresso[];
  anexos: WorkflowAnexo[];
  historico: WorkflowHistoricoItem[];
}

export interface WorkflowSugestaoEtapa {
  titulo: string;
  instrucao: string | null;
}

export interface WorkflowSugestaoFase {
  nome: string;
  etapas: WorkflowSugestaoEtapa[];
}

export interface WorkflowSugestoesCategoria {
  orientacoes: Array<{ titulo: string; conteudo: string }>;
  fases: WorkflowSugestaoFase[];
}
