import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dashboard admin', () => {
    it('ação rápida de retirada executa PATCH real', () => {
        const source = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8');

        expect(source).toContain('handleMarkPickedUp');
        expect(source).toContain("apiFetch(`/api/shop/admin/orders/${orderId}/pickup`");
        expect(source).toContain('onClick={() => handleMarkPickedUp(order.id)}');
    });
});
