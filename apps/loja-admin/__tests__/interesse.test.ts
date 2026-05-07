import { describe, expect, it } from 'vitest';

import { formatInterestItems } from '../lib/interesse';

describe('lista de interesse', () => {
    it('formata produto, tamanho e quantidade dos itens solicitados', () => {
        const items = formatInterestItems([
            {
                quantity: 2,
                variant: {
                    size: '8',
                    product: {
                        name: 'Camiseta',
                    },
                },
            },
            {
                quantity: 1,
                variant: {
                    size: 'P',
                    product: {
                        name: 'Bermuda',
                    },
                },
            },
        ]);

        expect(items).toEqual([
            'Camiseta - Tam. 8 (2 un.)',
            'Bermuda - Tam. P (1 un.)',
        ]);
    });

    it('usa texto seguro quando o item vem incompleto da API', () => {
        expect(formatInterestItems([{ quantity: 1 }])).toEqual([
            'Produto não identificado (1 un.)',
        ]);
    });
});
