import { describe, expect, it } from 'vitest';
import { contarAssentosVendaveis, resumoInventario, prepararConfirmacaoMapa } from './inventory-map-contracts';

describe('contratos de mapa e inventário', () => {
  it('não conta bloqueados para a capacidade', () => {
    expect(contarAssentosVendaveis([
      { status: 'DISPONIVEL' }, { status: 'LIBERADO' }, { status: 'BLOQUEADO' },
    ])).toBe(2);
  });
  it('marca inventário insuficiente quando vendáveis ficam abaixo da capacidade', () => {
    expect(resumoInventario({ capacity: 3, seats: [{ status: 'DISPONIVEL' }, { status: 'BLOQUEADO' }, { status: 'VENDIDO' }] })).toMatchObject({ sellable: 1, ready: false, needsReview: true });
  });
  it('confirma mapa preservando aviso de revisão dos inventários afetados', () => {
    expect(prepararConfirmacaoMapa({ mapId: 'map-1', affectedSessionIds: ['s-1'], inventoryStatus: 'EM_REVISAO' })).toEqual(expect.objectContaining({ mapId: 'map-1', requiresInventoryReview: true, affectedSessionIds: ['s-1'] }));
  });
});
