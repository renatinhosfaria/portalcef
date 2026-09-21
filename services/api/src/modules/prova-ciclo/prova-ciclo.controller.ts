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
import { ProvaCicloService } from "./prova-ciclo.service";
import { CriarCicloDto, EditarCicloDto } from "./dto/prova-ciclo.dto";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

const VISUALIZAR_CICLOS_ROLES = [
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

const GERENCIAR_CICLOS_ROLES = [
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

@Controller("prova-ciclo")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class ProvaCicloController {
  constructor(private readonly service: ProvaCicloService) {}

  @Get()
  @Roles(...VISUALIZAR_CICLOS_ROLES)
  async listarCiclos(
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
      throw new BadRequestException("Sessao invalida: unitId ausente");
    }
    const data = await this.service.listarPorUnidade(session.unitId);
    return { success: true, data };
  }

  @Get("turma/:turmaId")
  @Roles(...VISUALIZAR_CICLOS_ROLES)
  async buscarCiclosDaTurma(
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
      throw new BadRequestException("Sessao invalida: unitId ausente");
    }
    const data = await this.service.buscarPorTurma(turmaId, session.unitId);
    return { success: true, data };
  }

  @Get(":id")
  @Roles(...VISUALIZAR_CICLOS_ROLES)
  async buscarCiclo(
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
      throw new BadRequestException("Sessao invalida: unitId ausente");
    }
    const data = await this.service.buscarPorId(id, session.unitId);
    return { success: true, data };
  }

  @Post()
  @Roles(...GERENCIAR_CICLOS_ROLES)
  async criarCiclo(
    @CurrentUser()
    session: {
      userId: string;
      role: string;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    },
    @Body() dto: CriarCicloDto,
  ) {
    // Validar permissao de gestao
    if (!this.podeEditarEtapa(session.role, dto.etapa)) {
      throw new ForbiddenException("Sem permissao para criar ciclos");
    }

    if (!session.unitId) {
      throw new BadRequestException("Sessao invalida: unitId ausente");
    }

    const data = await this.service.criarCiclo(
      session.unitId,
      session.userId,
      dto,
    );
    return { success: true, data };
  }

  @Put(":id")
  @Roles(...GERENCIAR_CICLOS_ROLES)
  async editarCiclo(
    @CurrentUser()
    session: {
      userId: string;
      role: string;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    },
    @Param("id") id: string,
    @Body() dto: EditarCicloDto,
  ) {
    if (!session.unitId) {
      throw new BadRequestException("Sessao invalida: unitId ausente");
    }

    // Buscar ciclo e validar tenant
    const ciclo = await this.service.buscarPorId(id, session.unitId);

    // Validar permissao de gestao
    if (!this.podeEditarEtapa(session.role, ciclo.etapa)) {
      throw new ForbiddenException("Sem permissao para editar ciclos");
    }

    const data = await this.service.editarCiclo(id, session.unitId, dto);
    return { success: true, data };
  }

  @Delete(":id")
  @Roles(...GERENCIAR_CICLOS_ROLES)
  async excluirCiclo(
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
      throw new BadRequestException("Sessao invalida: unitId ausente");
    }

    // Buscar ciclo e validar tenant
    const ciclo = await this.service.buscarPorId(id, session.unitId);

    // Validar permissao de gestao
    if (!this.podeEditarEtapa(session.role, ciclo.etapa)) {
      throw new ForbiddenException("Sem permissao para excluir ciclos");
    }

    const result = await this.service.excluirCiclo(id, session.unitId);
    return { success: true, data: result };
  }

  private podeEditarEtapa(role: string, _etapa: string): boolean {
    return (GERENCIAR_CICLOS_ROLES as readonly string[]).includes(role);
  }
}
