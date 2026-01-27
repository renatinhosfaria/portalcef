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

    it('deve aceitar dataMaximaEntrega antes do início', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-03-10',
        dataFim: '2026-03-20',
        dataMaximaEntrega: '2026-03-08', // ✅ ANTES do início
      };

      const result = await service.criarPeriodo('unidade-id', 'user-id', dto);
      expect(result).toBe(null); // TODO para Task 8
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

    it('deve lançar erro se dataMaximaEntrega >= dataInicio', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-03-10',
        dataFim: '2026-03-20',
        dataMaximaEntrega: '2026-03-15', // ❌ Durante o período (inválido)
      };

      await expect(
        service.criarPeriodo('unidade-id', 'user-id', dto)
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro se dataMaximaEntrega == dataInicio', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-03-10',
        dataFim: '2026-03-20',
        dataMaximaEntrega: '2026-03-10', // ❌ Igual ao início (inválido)
      };

      await expect(
        service.criarPeriodo('unidade-id', 'user-id', dto)
      ).rejects.toThrow(BadRequestException);
    });

    it('deve aceitar datas válidas com dataMaximaEntrega antes do início', async () => {
      const dto = {
        etapa: 'INFANTIL',
        dataInicio: '2026-03-10',
        dataFim: '2026-03-20',
        dataMaximaEntrega: '2026-03-05', // ✅ Antes do início (válido)
      };

      const result = await service.criarPeriodo('unidade-id', 'user-id', dto);

      // Por enquanto retorna null (TODO para Task 8)
      expect(result).toBe(null);
    });
  });

  describe('verificarSobreposicao', () => {
    it('deve retornar períodos sobrepostos quando houver conflito', async () => {
      // Mock: assumir que já existe período de 01/03 a 15/03
      jest.spyOn(service as any, 'buscarPeriodosPorEtapa').mockResolvedValue([
        {
          id: 'periodo-1',
          dataInicio: new Date('2026-03-01'),
          dataFim: new Date('2026-03-15'),
        },
      ]);

      const resultado = await service['verificarSobreposicao'](
        'unidade-id',
        'INFANTIL',
        new Date('2026-03-10'),
        new Date('2026-03-20')
      );

      expect(resultado).toHaveLength(1);
    });

    it('deve retornar vazio quando não houver sobreposição', async () => {
      jest.spyOn(service as any, 'buscarPeriodosPorEtapa').mockResolvedValue([
        {
          id: 'periodo-1',
          dataInicio: new Date('2026-03-01'),
          dataFim: new Date('2026-03-15'),
        },
      ]);

      const resultado = await service['verificarSobreposicao'](
        'unidade-id',
        'INFANTIL',
        new Date('2026-03-16'),
        new Date('2026-03-30')
      );

      expect(resultado).toHaveLength(0);
    });
  });
});
