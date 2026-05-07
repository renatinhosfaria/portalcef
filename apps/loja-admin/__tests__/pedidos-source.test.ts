import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('pedidos admin', () => {
    it('não oferece exclusão definitiva para pedidos pagos ou retirados', () => {
        const source = readFileSync(join(process.cwd(), 'app/pedidos/page.tsx'), 'utf8');

        expect(source).toContain("['AGUARDANDO_PAGAMENTO', 'CANCELADO', 'EXPIRADO'].includes(order.status)");
        expect(source).not.toContain("'RETIRADO', 'PAGO'].includes(order.status)");
    });

    it('não permite BRINDE parcial na confirmação de pagamento', () => {
        const source = readFileSync(join(process.cwd(), 'app/pedidos/page.tsx'), 'utf8');

        expect(source).toContain('finalTotalPaid !== confirmPaymentModal.totalAmount');
        expect(source).not.toContain('!hasBrinde && finalTotalPaid !== confirmPaymentModal.totalAmount');
        expect(source).not.toContain("currentModalPaymentMethod === 'BRINDE' || currentModalPaymentAmount === confirmPaymentModal.totalAmount");
        expect(source).not.toContain("if (currentModalPaymentMethod === 'BRINDE') {\n            setCurrentModalPaymentAmount(0);");
    });
});
