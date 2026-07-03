import type {
  WorkflowCategoria,
  WorkflowExecucaoDetalhe,
  WorkflowModeloDetalhe,
  WorkflowModeloStatus,
} from "./workflows";

const statusModelo: WorkflowModeloStatus = "PUBLICADO";

const modelo: WorkflowModeloDetalhe = {
  id: "modelo-1",
  schoolId: "school-1",
  unitId: "unit-1",
  categoriaId: "categoria-1",
  nome: "Evento Dia dos Pais",
  descricaoCurta: "Protocolo operacional do evento",
  status: statusModelo,
  criadoPor: "gestor-1",
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
  categoria: {
    id: "categoria-1",
    schoolId: "school-1",
    unitId: "unit-1",
    nome: "Eventos",
    ativo: true,
    ordem: 1,
    createdAt: "2026-07-03T10:00:00.000Z",
    updatedAt: "2026-07-03T10:00:00.000Z",
  },
  orientacoes: [
    { id: "ori-1", titulo: "Objetivo", conteudo: "Organizar", ordem: 1 },
  ],
  fases: [
    {
      id: "fase-1",
      nome: "Preparacao",
      ordem: 1,
      etapas: [
        {
          id: "etapa-1",
          titulo: "Definir data",
          instrucao: "Confirmar no calendario",
          ordem: 1,
          versao: 1,
          updatedAt: "2026-07-03T10:00:00.000Z",
        },
      ],
    },
  ],
};

const categoria: WorkflowCategoria = modelo.categoria;

const execucao: WorkflowExecucaoDetalhe = {
  id: "execucao-1",
  schoolId: "school-1",
  unitId: "unit-1",
  modeloId: modelo.id,
  titulo: "Evento Dia dos Pais 2027",
  status: "EM_ANDAMENTO",
  teste: false,
  modeloAtualizado: true,
  iniciadoPor: "user-1",
  concluidoAt: null,
  canceladoAt: null,
  motivoCancelamento: null,
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
  modelo,
  faseAtual: "Preparacao",
  progressoPercentual: 0,
  progresso: [
    {
      etapaId: "etapa-1",
      concluida: false,
      observacao: "Aguardando agenda",
      concluidaPor: null,
      concluidaAt: null,
      etapaVersao: 1,
    },
  ],
  anexos: [],
  historico: [
    {
      id: "hist-1",
      tipo: "WORKFLOW_INICIADO",
      descricao: "Workflow iniciado",
      motivo: null,
      autorId: "user-1",
      autorNome: "Professora Teste",
      createdAt: "2026-07-03T10:00:00.000Z",
    },
  ],
};

void categoria;
void execucao;
