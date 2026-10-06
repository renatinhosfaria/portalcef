import { describe, expect, it } from 'vitest';

import { transformarProdutosDoCatalogo } from '../lib/catalog';

describe('transformação do catálogo', () => {
    it('preserva as imagens da galeria para o card do produto', () => {
        const produtos = transformarProdutosDoCatalogo([
            {
                id: 'produto-1',
                name: 'Camiseta',
                basePrice: 5000,
                imageUrl: 'principal.jpg',
                images: ['principal.jpg', 'costas.jpg'],
                category: 'UNIFORME_UNISSEX',
                variants: [{ availableStock: 2, price: 5000 }],
            },
        ], 'PRONTA_ENTREGA');

        expect(produtos[0].images).toEqual(['principal.jpg', 'costas.jpg']);
    });
});
