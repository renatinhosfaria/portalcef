import { describe, expect, it } from 'vitest';

import {
    getInventoryRowKey,
    getInventoryUnitLabel,
} from '../lib/inventory';

describe('inventário admin', () => {
    it('identifica linhas por variante e unidade', () => {
        expect(getInventoryRowKey({ variantId: 'variant-1', unitId: 'unit-1' })).toBe('variant-1:unit-1');
    });

    it('exibe nome da unidade quando disponível', () => {
        expect(getInventoryUnitLabel({ unitId: 'unit-1', unitName: 'Unidade Centro' })).toBe('Unidade Centro');
        expect(getInventoryUnitLabel({ unitId: 'unit-1' })).toBe('Unidade unit-1');
    });
});
