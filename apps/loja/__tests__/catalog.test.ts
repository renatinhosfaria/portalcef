import { describe, expect, it } from 'vitest';

import { getCatalogCardPrice } from '../lib/catalog';

describe('catálogo público', () => {
    it('usa o menor preço efetivo disponível no card do produto', () => {
        const product = {
            basePrice: 5000,
            variants: [
                { price: 5200, availableStock: 3 },
                { price: 4500, availableStock: 2 },
                { price: 4000, availableStock: 0 },
            ],
        };

        expect(getCatalogCardPrice(product)).toBe(45);
    });

    it('usa preço base quando nenhuma variante disponível informa preço efetivo', () => {
        const product = {
            basePrice: 5000,
            variants: [
                { price: 4500, availableStock: 0 },
            ],
        };

        expect(getCatalogCardPrice(product)).toBe(50);
    });
});
