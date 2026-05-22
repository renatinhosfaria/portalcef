import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { SemanaRelatorioService } from "./semana-relatorio.service";
import {
  CriarSemanaRelatorioDto,
  EditarSemanaRelatorioDto,
} from "./dto/semana-relatorio.dto";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

type UserContext = {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
};

const VISUALIZAR_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "analista_pedagogico",
  "professora",
  "auxiliar_sala",
] as const;

const GERENCIAR_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
] as const;

@Controller("semana-relatorio")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class SemanaRelatorioController {
  constructor(private readonly service: SemanaRelatorioService) {}

  @Get()
  @Roles(...VISUALIZAR_ROLES)
  async listarSemanas(@CurrentUser() session: UserContext) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    const data = await this.service.listarPorUnidade(session.unitId);
    return { success: true, data };
  }

  @Get("turma/:turmaId")
  @Roles(...VISUALIZAR_ROLES)
  async buscarPorTurma(
    @CurrentUser() session: UserContext,
    @Param("turmaId") turmaId: string,
  ) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    const data = await this.service.buscarPorTurma(turmaId, session.unitId);
    return { success: true, data };
  }

  @Get(":id")
  @Roles(...VISUALIZAR_ROLES)
  async buscarSemana(
    @CurrentUser() session: UserContext,
    @Param("id") id: string,
  ) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    const data = await this.service.buscarPorId(id, session.unitId);
    return { success: true, data };
  }

  @Post()
  @Roles(...GERENCIAR_ROLES)
  async criarSemana(
    @CurrentUser() session: UserContext,
    @Body() dto: CriarSemanaRelatorioDto,
  ) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    if (!this.podeGerenciarEtapa(session.role, dto.etapa)) {
      throw new ForbiddenException("Sem permissão para criar semanas desta etapa");
    }
    const data = await this.service.criar(dto, session.unitId, session.userId);
    return { success: true, data };
  }

  @Patch(":id")
  @Roles(...GERENCIAR_ROLES)
  async editarSemana(
    @CurrentUser() session: UserContext,
    @Param("id") id: string,
    @Body() dto: EditarSemanaRelatorioDto,
  ) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    const semana = await this.service.buscarPorId(id, session.unitId);
    if (!this.podeGerenciarEtapa(session.role, semana.etapa)) {
      throw new ForbiddenException("Sem permissão para editar semanas desta etapa");
    }
    const data = await this.service.editar(id, dto, session.unitId);
    return { success: true, data };
  }

  @Delete(":id")
  @Roles(...GERENCIAR_ROLES)
  async excluirSemana(
    @CurrentUser() session: UserContext,
    @Param("id") id: string,
  ) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    const semana = await this.service.buscarPorId(id, session.unitId);
    if (!this.podeGerenciarEtapa(session.role, semana.etapa)) {
      throw new ForbiddenException("Sem permissão para excluir semanas desta etapa");
    }
    await this.service.excluir(id, session.unitId);
    return { success: true };
  }

  private podeGerenciarEtapa(role: string, etapa: string): boolean {
    if (["master", "diretora_geral", "gerente_unidade", "coordenadora_geral"].includes(role)) {
      return true;
    }
    const mapeamento: Record<string, string[]> = {
      coordenadora_bercario: ["BERCARIO"],
      coordenadora_infantil: ["INFANTIL"],
    };
    return mapeamento[role]?.includes(etapa) ?? false;
  }
}
