import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    getProductsForPresentialSale,
    getSelectableVariants,
    getVariantEffectivePrice,
} from '../lib/venda-presencial';

describe('venda presencial', () => {
    const product = {
        id: 'product-1',
        name: 'Camiseta',
        basePrice: 4500,
        variants: [
            {
                id: 'variant-price',
                size: '8',
                priceOverride: 5000,
                isActive: true,
            },
            {
                id: 'variant-base',
                size: '10',
                priceOverride: null,
                isActive: true,
            },
            {
                id: 'variant-inactive',
                size: '12',
                priceOverride: 5500,
                isActive: false,
            },
            {
                id: 'variant-sem-estoque',
                size: '14',
                priceOverride: null,
                isActive: true,
                availableStock: 0,
            },
        ],
    };

    it('usa priceOverride da variante quando existir', () => {
        expect(getVariantEffectivePrice(product.variants[0], product)).toBe(5000);
        expect(getVariantEffectivePrice(product.variants[1], product)).toBe(4500);
    });

    it('remove variantes inativas da seleção presencial', () => {
        expect(getSelectableVariants(product).map((variant) => variant.id)).toEqual([
            'variant-price',
            'variant-base',
        ]);
    });

    it('nao lista produto de pre-venda na venda presencial', () => {
        const products = [
            { id: 'p1', name: 'Moletom', isPreSale: true, basePrice: 10000, variants: [{ id: 'v1', size: '8', priceOverride: null, isActive: true, availableStock: 10 }] },
            { id: 'p2', name: 'Camiseta', isPreSale: false, basePrice: 5000, variants: [{ id: 'v2', size: '8', priceOverride: null, isActive: true, availableStock: 10 }] },
        ] as never;

        expect(getProductsForPresentialSale(products)).toHaveLength(1);
        expect(getProductsForPresentialSale(products)[0].id).toBe('p2');
    });

    it('não permite BRINDE parcial como atalho de quitação', () => {
        const source = readFileSync(join(process.cwd(), 'app/venda-presencial/page.tsx'), 'utf8');

        expect(source).toContain('finalTotalPaid !== totalAmount');
        expect(source).not.toContain('!hasBrinde && finalTotalPaid !== totalAmount');
        expect(source).not.toContain('isImplicitBrinde');
        expect(source).not.toContain('remainingAmount === 0 || hasBrinde');
        expect(source).not.toContain("if (currentPaymentMethod === 'BRINDE') {\n            setCurrentPaymentAmount(0);");
    });
});
