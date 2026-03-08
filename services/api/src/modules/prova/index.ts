// Prova Module - Workflow de aprovação de provas
export { ProvaModule } from "./prova.module";
export {
  ProvaService,
  type UserContext,
  type ProvaComDocumentos,
  type DashboardItem,
} from "./prova.service";
export {
  // DTOs
  type CreateProvaDto,
  type DevolverProvaDto,
  type ListProvasQueryDto,
  type DashboardProvasQueryDto,
  type ListarProvasGestaoDto,
  // Schemas (Zod)
  createProvaSchema,
  devolverProvaSchema,
  listProvasQuerySchema,
  dashboardProvasQuerySchema,
  listarProvasGestaoSchema,
  // Status Map
  PROVA_STATUS_URL_MAP,
} from "./dto/prova.dto";
