import { Test, TestingModule } from '@nestjs/testing';
import { PlanoAulaPeriodoController } from './plano-aula-periodo.controller';
import { PlanoAulaPeriodoService } from './plano-aula-periodo.service';
import { ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

// Mock do @essencia/db
jest.mock('@essencia/db', () => ({
  planoAulaPeriodo: {},
  eq: jest.fn(),
  and: jest.fn(),
  asc: jest.fn(),
  getDb: jest.fn(),
}));

describe('PlanoAulaPeriodoController', () => {
  let controller: PlanoAulaPeriodoController;
  let service: PlanoAulaPeriodoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanoAulaPeriodoController],
      providers: [
        {
          provide: PlanoAulaPeriodoService,
          useValue: {
            criarPeriodo: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PlanoAulaPeriodoController>(PlanoAulaPeriodoController);
    service = module.get<PlanoAulaPeriodoService>(PlanoAulaPeriodoService);
  });

  describe('POST /plano-aula-periodo', () => {
    it('deve bloquear coordenadora_infantil criando período de FUNDAMENTAL_I', async () => {
      const session = { role: 'coordenadora_infantil', unitId: 'unidade-id', userId: 'user-id', schoolId: 'school-id', stageId: null };
      const dto = { etapa: 'FUNDAMENTAL_I', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-02-25' };

      await expect(controller.criarPeriodo(session, dto)).rejects.toThrow(ForbiddenException);
    });

    it('deve permitir coordenadora_infantil criando período de INFANTIL', async () => {
      const session = { role: 'coordenadora_infantil', unitId: 'unidade-id', userId: 'user-id', schoolId: 'school-id', stageId: null };
      const dto = { etapa: 'INFANTIL', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-02-25' };

      jest.spyOn(service, 'criarPeriodo').mockResolvedValue({ id: 'periodo-id' } as any);

      await expect(controller.criarPeriodo(session, dto)).resolves.toBeDefined();
    });

    it('deve bloquear coordenadora_fundamental_i criando período de INFANTIL', async () => {
      const session = { role: 'coordenadora_fundamental_i', unitId: 'unidade-id', userId: 'user-id', schoolId: 'school-id', stageId: null };
      const dto = { etapa: 'INFANTIL', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-02-25' };

      await expect(controller.criarPeriodo(session, dto)).rejects.toThrow(ForbiddenException);
    });

    it('deve permitir coordenadora_fundamental_i criando período de FUNDAMENTAL_I', async () => {
      const session = { role: 'coordenadora_fundamental_i', unitId: 'unidade-id', userId: 'user-id', schoolId: 'school-id', stageId: null };
      const dto = { etapa: 'FUNDAMENTAL_I', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-02-25' };

      jest.spyOn(service, 'criarPeriodo').mockResolvedValue({ id: 'periodo-id' } as any);

      await expect(controller.criarPeriodo(session, dto)).resolves.toBeDefined();
    });

    it('deve permitir diretora_geral criando período de qualquer etapa (INFANTIL)', async () => {
      const session = { role: 'diretora_geral', unitId: 'unidade-id', userId: 'user-id', schoolId: 'school-id', stageId: null };
      const dto = { etapa: 'INFANTIL', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-02-25' };

      jest.spyOn(service, 'criarPeriodo').mockResolvedValue({ id: 'periodo-id' } as any);

      await expect(controller.criarPeriodo(session, dto)).resolves.toBeDefined();
    });

    it('deve permitir diretora_geral criando período de qualquer etapa (FUNDAMENTAL_II)', async () => {
      const session = { role: 'diretora_geral', unitId: 'unidade-id', userId: 'user-id', schoolId: 'school-id', stageId: null };
      const dto = { etapa: 'FUNDAMENTAL_II', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-02-25' };

      jest.spyOn(service, 'criarPeriodo').mockResolvedValue({ id: 'periodo-id' } as any);

      await expect(controller.criarPeriodo(session, dto)).resolves.toBeDefined();
    });

    it('deve permitir coordenadora_geral criando período de qualquer etapa', async () => {
      const session = { role: 'coordenadora_geral', unitId: 'unidade-id', userId: 'user-id', schoolId: 'school-id', stageId: null };
      const dto = { etapa: 'BERCARIO', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-02-25' };

      jest.spyOn(service, 'criarPeriodo').mockResolvedValue({ id: 'periodo-id' } as any);

      await expect(controller.criarPeriodo(session, dto)).resolves.toBeDefined();
    });

    it('deve permitir gerente_unidade criando período de qualquer etapa', async () => {
      const session = { role: 'gerente_unidade', unitId: 'unidade-id', userId: 'user-id', schoolId: 'school-id', stageId: null };
      const dto = { etapa: 'MEDIO', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-02-25' };

      jest.spyOn(service, 'criarPeriodo').mockResolvedValue({ id: 'periodo-id' } as any);

      await expect(controller.criarPeriodo(session, dto)).resolves.toBeDefined();
    });

    it('deve usar unitId e userId da sessão, não do payload', async () => {
      const session = { role: 'coordenadora_infantil', unitId: 'session-unidade-id', userId: 'session-user-id', schoolId: 'school-id', stageId: null };
      const dto = { etapa: 'INFANTIL', dataInicio: '2026-03-01', dataFim: '2026-03-15', dataMaximaEntrega: '2026-02-25' };

      const serviceSpy = jest.spyOn(service, 'criarPeriodo').mockResolvedValue({ id: 'periodo-id' } as any);

      await controller.criarPeriodo(session, dto);

      expect(serviceSpy).toHaveBeenCalledWith('session-unidade-id', 'session-user-id', dto);
    });
  });
});
