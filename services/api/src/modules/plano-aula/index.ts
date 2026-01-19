// Plano Aula Module - Workflow de aprovação de planos de aula
export { PlanoAulaModule } from "./plano-aula.module";
export { PlanoAulaService, type UserContext, type PlanoComDocumentos, type DashboardItem, type QuinzenaDeadline } from "./plano-aula.service";
export {
  // DTOs
  type CreatePlanoDto,
  type AddComentarioDto,
  type DevolverPlanoDto,
  type SetDeadlineDto,
  type ListPlanosQueryDto,
  type DashboardQueryDto,
  // Schemas (Zod)
  createPlanoSchema,
  addComentarioSchema,
  devolverPlanoSchema,
  setDeadlineSchema,
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
