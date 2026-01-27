import {
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  BadRequestException,
} from "@nestjs/common";

import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TarefaAccessGuard } from "./guards/tarefa-access.guard";
import { TarefasService, type UserContext } from "./tarefas.service";
import {
  type CriarTarefaDto,
  criarTarefaSchema,
  type ListarTarefasDto,
  listarTarefasSchema,
} from "./dto/tarefas.dto";

// ============================================
// Role Arrays para Guards
// ============================================

/** Roles de gestão que podem criar tarefas para qualquer responsável */
const GESTAO_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
] as const;

/** Roles de coordenadoras (por etapa) */
const COORDENADORA_ROLES = [
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
] as const;

/** Roles de analistas */
const ANALISTA_ROLES = ["analista_pedagogico"] as const;

/** Roles de professoras */
const PROFESSORA_ROLES = ["professora", "auxiliar_sala"] as const;

/** Todas as roles que podem criar tarefas */
const CRIAR_TAREFA_ACCESS = [
  ...GESTAO_ROLES,
  ...COORDENADORA_ROLES,
  ...ANALISTA_ROLES,
  ...PROFESSORA_ROLES,
] as const;

/** Todas as roles que podem visualizar tarefas */
const VISUALIZAR_ACCESS = [...CRIAR_TAREFA_ACCESS] as const;

// ============================================
// Controller
// ============================================

/**
 * TarefasController
 *
 * Controller para gerenciamento de tarefas:
 * - Endpoints para CRUD de tarefas
 * - Filtros avançados com contextos
 * - Controle de acesso via guards
 *
 * NOTA: TenantGuard não é usado pois o isolamento de tenant é feito
 * via schoolId/unitId da sessão. O service valida acesso em cada método.
 */
@Controller("tarefas")
@UseGuards(AuthGuard, RolesGuard)
export class TarefasController {
  constructor(private readonly tarefasService: TarefasService) {}

  // ============================================
  // Endpoints de CRUD
  // ============================================

  /**
   * POST /tarefas
   * Cria nova tarefa
   */
  @Post()
  @Roles(...CRIAR_TAREFA_ACCESS)
  async criarTarefa(
    @Req() req: { user: UserContext },
    @Body() body: CriarTarefaDto,
  ) {
    // Validar DTO
    const parsed = criarTarefaSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        errors: parsed.error.errors,
      });
    }

    const { prazo, contextos, descricao, ...rest } = parsed.data;

    const tarefa = await this.tarefasService.criarManual(
      {
        ...rest,
        descricao: descricao ?? null,
        prazo: new Date(prazo),
        contextos: contextos ?? [],
      },
      req.user,
    );

    return {
      success: true,
      data: tarefa,
    };
  }

  /**
   * GET /tarefas
   * Lista tarefas com filtros e paginação
   */
  @Get()
  @Roles(...VISUALIZAR_ACCESS)
  async listarTarefas(
    @Req() req: { user: UserContext },
    @Query() query: ListarTarefasDto,
  ) {
    // Validar query params
    const parsed = listarTarefasSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Parâmetros inválidos",
        errors: parsed.error.errors,
      });
    }

    const result = await this.tarefasService.listar(req.user, parsed.data);

    return {
      success: true,
      ...result,
    };
  }

  // ============================================
  // Endpoints de Estatísticas
  // ============================================

  /**
   * GET /tarefas/stats/resumo
   * Retorna estatísticas de tarefas do usuário
   */
  @Get("stats/resumo")
  @Roles(...VISUALIZAR_ACCESS)
  async getResumoStats(@Req() req: { user: UserContext }) {
    if (!req.user.schoolId) {
      throw new BadRequestException("Sessão inválida: schoolId é obrigatório");
    }

    const stats = await this.tarefasService.getStats(
      req.user.userId,
      req.user.schoolId,
    );

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /tarefas/:id
   * Busca tarefa por ID
   *
   * SEGURANÇA:
   * - Guard valida isolamento de tenant (schoolId)
   * - Guard valida autorização baseada em role e relacionamento
   */
  @Get(":id")
  @Roles(...VISUALIZAR_ACCESS)
  @UseGuards(TarefaAccessGuard)
  async getTarefaById(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const tarefa = await this.tarefasService.findById(id);

    // Guard já validou autorização e existência da tarefa
    return {
      success: true,
      data: tarefa,
    };
  }

  /**
   * PATCH /tarefas/:id/concluir
   * Marca tarefa como concluída
   */
  @Patch(":id/concluir")
  @Roles(...VISUALIZAR_ACCESS)
  @UseGuards(TarefaAccessGuard)
  async concluirTarefa(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const tarefa = await this.tarefasService.concluir(id, req.user.userId);

    return {
      success: true,
      message: "Tarefa concluída com sucesso",
      data: tarefa,
    };
  }
}
