import {
  Controller,
  Post,
  Body,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PlanoAulaPeriodoService } from './plano-aula-periodo.service';
import { CriarPeriodoDto } from './dto/plano-aula-periodo.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('plano-aula-periodo')
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class PlanoAulaPeriodoController {
  constructor(private readonly service: PlanoAulaPeriodoService) {}

  @Post()
  @Roles(
    'diretora_geral',
    'gerente_unidade',
    'coordenadora_geral',
    'coordenadora_infantil',
    'coordenadora_fundamental_i',
    'coordenadora_fundamental_ii',
    'coordenadora_bercario',
    'coordenadora_medio'
  )
  async criarPeriodo(
    @CurrentUser() session: { userId: string; role: string; schoolId: string | null; unitId: string | null; stageId: string | null },
    @Body() dto: CriarPeriodoDto
  ) {
    // Validar permissão por etapa
    if (!this.podeEditarEtapa(session.role, dto.etapa)) {
      throw new ForbiddenException('Sem permissão para criar períodos desta etapa');
    }

    if (!session.unitId) {
      throw new BadRequestException('Sessão inválida: unitId ausente');
    }

    return this.service.criarPeriodo(session.unitId, session.userId, dto);
  }

  private podeEditarEtapa(role: string, etapa: string): boolean {
    const mapeamento: Record<string, string[]> = {
      coordenadora_infantil: ['INFANTIL'],
      coordenadora_fundamental_i: ['FUNDAMENTAL_I'],
      coordenadora_fundamental_ii: ['FUNDAMENTAL_II'],
      coordenadora_bercario: ['BERCARIO'],
      coordenadora_medio: ['MEDIO'],
    };

    // Roles globais podem editar qualquer etapa
    if (['diretora_geral', 'gerente_unidade', 'coordenadora_geral'].includes(role)) {
      return true;
    }

    return mapeamento[role]?.includes(etapa) || false;
  }
}
