import { Module } from '@nestjs/common';
import { PlanoAulaPeriodoService } from './plano-aula-periodo.service';
import { PlanoAulaPeriodoController } from './plano-aula-periodo.controller';

@Module({
  providers: [PlanoAulaPeriodoService],
  controllers: [PlanoAulaPeriodoController],
  exports: [PlanoAulaPeriodoService],
})
export class PlanoAulaPeriodoModule {}
