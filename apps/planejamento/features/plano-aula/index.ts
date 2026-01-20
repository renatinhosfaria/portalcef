// Types
export type {
  PlanoAulaStatus,
  DocumentoTipo,
  DocumentoComentario,
  PlanoDocumento,
  PlanoAula,
  PlanoAulaSummary,
  DashboardStats,
  DashboardData,
  CriarPlanoResult,
  AddComentarioDto,
  DevolverPlanoDto,
  QuinzenaConfig,
  PlanoAulaListItem,
  FiltrosGestaoPlanos,
  ListagemPlanosResponse,
} from "./types";

export { STATUS_LABELS, STATUS_COLORS, STATUS_FILTER_OPTIONS } from "./types";

// Hooks
export {
  usePlanoAula,
  useAnalistaActions,
  useCoordenadoraActions,
  useDashboard,
  useDeadlines,
  usePlanoDetalhe,
  useGestaoPlanos,
} from "./hooks";

// Components
export {
  DocumentoUpload,
  DocumentoList,
  DocumentoComentarios,
  PlanoStatusBadge,
} from "./components";
