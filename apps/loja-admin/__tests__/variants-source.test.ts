import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('gestão de variantes', () => {
    it('expõe erro e retry quando a API falha', () => {
        const source = readFileSync(join(process.cwd(), 'app/produtos/[id]/variantes/page.tsx'), 'utf8');

        expect(source).toContain('Não foi possível carregar as variantes');
        expect(source).toContain('Tentar novamente');
    });
});
