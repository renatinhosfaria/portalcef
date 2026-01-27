import { Test, TestingModule } from '@nestjs/testing';
import { PlanoAulaPeriodoService } from './plano-aula-periodo.service';
import { BadRequestException } from '@nestjs/common';

describe('PlanoAulaPeriodoService', () => {
  let service: PlanoAulaPeriodoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlanoAulaPeriodoService],
    }).compile();

    service = module.get<PlanoAulaPeriodoService>(PlanoAulaPeriodoService);
  });

  describe('criarPeriodo', () => {
    it('deve lançar erro se dataInicio >= dataFim', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-03-15',
        dataFim: '2026-03-10',
        dataMaximaEntrega: '2026-03-12',
      };

      await expect(
        service.criarPeriodo('unidade-id', 'user-id', dto)
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro se dataMaximaEntrega < dataInicio', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-03-10',
        dataFim: '2026-03-15',
        dataMaximaEntrega: '2026-03-05',
      };

      await expect(
        service.criarPeriodo('unidade-id', 'user-id', dto)
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro se datas forem inválidas', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-99-99', // Data inválida
        dataFim: '2026-03-15',
        dataMaximaEntrega: '2026-03-12',
      };

      await expect(
        service.criarPeriodo('unidade-id', 'user-id', dto)
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro se dataMaximaEntrega > dataFim', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-03-10',
        dataFim: '2026-03-15',
        dataMaximaEntrega: '2026-03-20', // Após o fim
      };

      await expect(
        service.criarPeriodo('unidade-id', 'user-id', dto)
      ).rejects.toThrow(BadRequestException);
    });

    it('deve aceitar datas válidas', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-03-10',
        dataFim: '2026-03-20',
        dataMaximaEntrega: '2026-03-15',
      };

      const result = await service.criarPeriodo('unidade-id', 'user-id', dto);

      // Por enquanto retorna null (TODO para Task 8)
      expect(result).toBe(null);
    });
  });
});
