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

@Controller("prova-ciclo")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class ProvaCicloController {
  constructor(private readonly service: ProvaCicloService) {}

  @Get()
  @Roles(
    "diretora_geral",
    "gerente_unidade",
    "coordenadora_geral",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_bercario",
    "coordenadora_medio",
    "analista_pedagogico",
    "professora",
  )
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
  @Roles(
    "diretora_geral",
    "gerente_unidade",
    "coordenadora_geral",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_bercario",
    "coordenadora_medio",
    "analista_pedagogico",
    "professora",
  )
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
  @Roles(
    "diretora_geral",
    "gerente_unidade",
    "coordenadora_geral",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_bercario",
    "coordenadora_medio",
    "analista_pedagogico",
    "professora",
  )
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
  @Roles(
    "diretora_geral",
    "gerente_unidade",
    "coordenadora_geral",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_bercario",
    "coordenadora_medio",
  )
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
    // Validar permissao por etapa
    if (!this.podeEditarEtapa(session.role, dto.etapa)) {
      throw new ForbiddenException(
        "Sem permissao para criar ciclos desta etapa",
      );
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
  @Roles(
    "diretora_geral",
    "gerente_unidade",
    "coordenadora_geral",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_bercario",
    "coordenadora_medio",
  )
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

    // Validar permissao por etapa
    if (!this.podeEditarEtapa(session.role, ciclo.etapa)) {
      throw new ForbiddenException(
        "Sem permissao para editar ciclos desta etapa",
      );
    }

    const data = await this.service.editarCiclo(id, dto);
    return { success: true, data };
  }

  @Delete(":id")
  @Roles(
    "diretora_geral",
    "gerente_unidade",
    "coordenadora_geral",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_bercario",
    "coordenadora_medio",
  )
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

    // Validar permissao por etapa
    if (!this.podeEditarEtapa(session.role, ciclo.etapa)) {
      throw new ForbiddenException(
        "Sem permissao para excluir ciclos desta etapa",
      );
    }

    const result = await this.service.excluirCiclo(id);
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
      ["diretora_geral", "gerente_unidade", "coordenadora_geral"].includes(role)
    ) {
      return true;
    }

    return mapeamento[role]?.includes(etapa) || false;
  }
}
