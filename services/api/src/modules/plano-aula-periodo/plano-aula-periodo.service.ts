import { Injectable, BadRequestException } from '@nestjs/common';
import { CriarPeriodoDto } from './dto/plano-aula-periodo.dto';

@Injectable()
export class PlanoAulaPeriodoService {
  async criarPeriodo(
    unidadeId: string,
    userId: string,
    dto: CriarPeriodoDto
  ) {
    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dto.dataFim);
    const dataMaximaEntrega = new Date(dto.dataMaximaEntrega);

    if (dataInicio >= dataFim) {
      throw new BadRequestException(
        'Data de início deve ser anterior à data de fim'
      );
    }

    if (dataMaximaEntrega < dataInicio) {
      throw new BadRequestException(
        'Data máxima de entrega deve ser posterior à data de início'
      );
    }

    // TODO: Implementar lógica de criação no banco
    return null;
  }
}
