// Types
export type {
  PlanoAulaStatus,
  DocumentoTipo,
  PlanoDocumento,
  PlanoAula,
  PlanoAulaSummary,
  DashboardStats,
  DashboardData,
  CriarPlanoResult,
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
  usePeriodoData,
} from "./hooks";

// Components
export {
  DocumentoUpload,
  DocumentoList,
  PlanoStatusBadge,
  HistoricoTimeline,
  PlanoHeader,
} from "./components";
