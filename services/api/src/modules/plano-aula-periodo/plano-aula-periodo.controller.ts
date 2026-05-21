import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PlanoAulaPeriodoService } from "./plano-aula-periodo.service";
import {
  CriarPeriodoDto,
  EditarPeriodoDto,
} from "./dto/plano-aula-periodo.dto";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

const VISUALIZAR_PERIODOS_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_bercario",
  "coordenadora_medio",
  "analista_pedagogico",
  "professora",
] as const;

const GERENCIAR_PERIODOS_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_bercario",
  "coordenadora_medio",
] as const;

@Controller("plano-aula-periodo")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class PlanoAulaPeriodoController {
  constructor(private readonly service: PlanoAulaPeriodoService) {}

  @Get()
  @Roles(...VISUALIZAR_PERIODOS_ROLES)
  async listarPeriodos(
    @CurrentUser()
    session: {
      userId: string;
      role: string;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    },
  ) {
    if (!session.unitId) {
      throw new BadRequestException("Sessão inválida: unitId ausente");
    }
    const data = await this.service.listarPorUnidade(session.unitId);
    return { success: true, data };
  }

  @Get("turma/:turmaId")
  @Roles(...VISUALIZAR_PERIODOS_ROLES)
  async buscarPeriodosDaTurma(
    @CurrentUser()
    session: {
      userId: string;
      role: string;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    },
    @Param("turmaId") turmaId: string,
  ) {
    if (!session.unitId) {
      throw new BadRequestException("Sessão inválida: unitId ausente");
    }
    const data = await this.service.buscarPorTurma(turmaId, session.unitId);
    return { success: true, data };
  }

  @Get(":id")
  @Roles(...VISUALIZAR_PERIODOS_ROLES)
  async buscarPeriodo(
    @CurrentUser()
    session: {
      userId: string;
      role: string;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    },
    @Param("id") id: string,
  ) {
    if (!session.unitId) {
      throw new BadRequestException("Sessão inválida: unitId ausente");
    }
    const data = await this.service.buscarPorId(id, session.unitId);
    return { success: true, data };
  }

  @Post()
  @Roles(...GERENCIAR_PERIODOS_ROLES)
  async criarPeriodo(
    @CurrentUser()
    session: {
      userId: string;
      role: string;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    },
    @Body() dto: CriarPeriodoDto,
  ) {
    // Validar permissão por etapa
    if (!this.podeEditarEtapa(session.role, dto.etapa)) {
      throw new ForbiddenException(
        "Sem permissão para criar períodos desta etapa",
      );
    }

    if (!session.unitId) {
      throw new BadRequestException("Sessão inválida: unitId ausente");
    }

    const data = await this.service.criarPeriodo(
      session.unitId,
      session.userId,
      dto,
    );
    return { success: true, data };
  }

  @Put(":id")
  @Roles(...GERENCIAR_PERIODOS_ROLES)
  async editarPeriodo(
    @CurrentUser()
    session: {
      userId: string;
      role: string;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    },
    @Param("id") id: string,
    @Body() dto: EditarPeriodoDto,
  ) {
    if (!session.unitId) {
      throw new BadRequestException("Sessão inválida: unitId ausente");
    }

    // Buscar período e validar tenant (Task 12 corrigiu buscarPorId para receber unitId)
    const periodo = await this.service.buscarPorId(id, session.unitId);

    // Validar permissão por etapa (mesma lógica do POST)
    if (!this.podeEditarEtapa(session.role, periodo.etapa)) {
      throw new ForbiddenException(
        "Sem permissão para editar períodos desta etapa",
      );
    }

    const data = await this.service.editarPeriodo(id, dto);
    return { success: true, data };
  }

  @Delete(":id")
  @Roles(...GERENCIAR_PERIODOS_ROLES)
  async excluirPeriodo(
    @CurrentUser()
    session: {
      userId: string;
      role: string;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    },
    @Param("id") id: string,
  ) {
    if (!session.unitId) {
      throw new BadRequestException("Sessão inválida: unitId ausente");
    }

    // Buscar período e validar tenant
    const periodo = await this.service.buscarPorId(id, session.unitId);

    // Validar permissão por etapa
    if (!this.podeEditarEtapa(session.role, periodo.etapa)) {
      throw new ForbiddenException(
        "Sem permissão para excluir períodos desta etapa",
      );
    }

    const result = await this.service.excluirPeriodo(id);
    return { success: true, data: result };
  }

  private podeEditarEtapa(role: string, etapa: string): boolean {
    const mapeamento: Record<string, string[]> = {
      coordenadora_infantil: ["INFANTIL"],
      coordenadora_fundamental_i: ["FUNDAMENTAL_I"],
      coordenadora_fundamental_ii: ["FUNDAMENTAL_II"],
      coordenadora_bercario: ["BERCARIO"],
      coordenadora_medio: ["MEDIO"],
    };

    // Roles globais podem editar qualquer etapa
    if (
      [
        "master",
        "diretora_geral",
        "gerente_unidade",
        "coordenadora_geral",
      ].includes(role)
    ) {
      return true;
    }

    return mapeamento[role]?.includes(etapa) || false;
  }
}
