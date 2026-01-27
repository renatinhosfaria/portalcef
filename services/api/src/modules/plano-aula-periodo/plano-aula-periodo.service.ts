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

    if (dataMaximaEntrega >= dataInicio) {
      throw new BadRequestException(
        'Data máxima de entrega deve ser anterior ao início do período'
      );
    }

    // TODO: Implementar lógica de criação no banco
    return null;
  }

  private async verificarSobreposicao(
    unidadeId: string,
    etapa: string,
    dataInicio: Date,
    dataFim: Date
  ) {
    const periodos = await this.buscarPeriodosPorEtapa(unidadeId, etapa);

    return periodos.filter((periodo) => {
      const inicio = new Date(periodo.dataInicio);
      const fim = new Date(periodo.dataFim);

      // Verifica se há sobreposição
      return dataInicio <= fim && dataFim >= inicio;
    });
  }

  private async buscarPeriodosPorEtapa(
    unidadeId: string,
    etapa: string
  ): Promise<Array<{ id: string; numero: number; dataInicio: Date; dataFim: Date }>> {
    // TODO: Implementar busca real no banco
    return [];
  }

  private async calcularProximoNumero(
    unidadeId: string,
    etapa: string,
    dataInicio: Date
  ): Promise<number> {
    const periodos = await this.buscarPeriodosPorEtapa(unidadeId, etapa);

    if (periodos.length === 0) {
      return 1;
    }

    const periodosOrdenados = periodos.sort(
      (a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime()
    );

    let posicao = 1;
    for (const periodo of periodosOrdenados) {
      if (dataInicio < new Date(periodo.dataInicio)) {
        break;
      }
      posicao++;
    }

    return posicao;
  }
}
