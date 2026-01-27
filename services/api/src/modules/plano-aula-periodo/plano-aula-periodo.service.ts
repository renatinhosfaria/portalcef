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

    // Validar se as datas são válidas (não são NaN)
    if (isNaN(dataInicio.getTime())) {
      throw new BadRequestException('Data de início inválida');
    }
    if (isNaN(dataFim.getTime())) {
      throw new BadRequestException('Data de fim inválida');
    }
    if (isNaN(dataMaximaEntrega.getTime())) {
      throw new BadRequestException('Data máxima de entrega inválida');
    }

    if (dataInicio >= dataFim) {
      throw new BadRequestException(
        'Data de início deve ser anterior à data de fim'
      );
    }

    if (dataMaximaEntrega < dataInicio || dataMaximaEntrega > dataFim) {
      throw new BadRequestException(
        'Data máxima de entrega deve estar entre início e fim do período'
      );
    }

    // TODO: Implementar lógica de criação no banco
    return null;
  }
}
