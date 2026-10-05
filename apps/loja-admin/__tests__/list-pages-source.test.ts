import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('listagens administrativas da loja', () => {
    it('não transforma falha da API de produtos em lista vazia silenciosa', () => {
        const source = readFileSync(join(process.cwd(), 'app/produtos/page.tsx'), 'utf8');

        expect(source).toContain('Não foi possível carregar os produtos');
        expect(source).toContain('Tentar novamente');
    });

    it('não transforma falha da API de pedidos em lista vazia silenciosa', () => {
        const source = readFileSync(join(process.cwd(), 'app/pedidos/page.tsx'), 'utf8');

        expect(source).toContain('Não foi possível carregar os pedidos');
        expect(source).toContain('Tentar novamente');
    });
});
