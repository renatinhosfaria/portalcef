// Plano Aula Module - Workflow de aprovação de planos de aula
export { PlanoAulaModule } from "./plano-aula.module";
export {
  PlanoAulaService,
  type UserContext,
  type PlanoComDocumentos,
  type DashboardItem,
} from "./plano-aula.service";
export {
  // DTOs
  type CreatePlanoDto,
  type DevolverPlanoDto,
  type ListPlanosQueryDto,
  type DashboardQueryDto,
  // Schemas (Zod)
  createPlanoSchema,
  devolverPlanoSchema,
  listPlanosQuerySchema,
  dashboardQuerySchema,
  // Role Constants
  ANALISTA_ROLES,
  COORDENADORA_ROLES,
  GESTAO_ROLES,
  PROFESSORA_ROLES,
  // Type Guards
  isAnalista,
  isCoordenadora,
  isGestao,
  isProfessora,
  // Utilities
  COORDENADORA_STAGE_MAP,
  getSegmentosPermitidos,
} from "./dto/plano-aula.dto";
