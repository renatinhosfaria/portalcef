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

    it('identifica pedidos de pré-venda na lista e no detalhe', () => {
        const listSource = readFileSync(join(process.cwd(), 'app/pedidos/page.tsx'), 'utf8');
        const detailSource = readFileSync(join(process.cwd(), 'app/pedidos/[id]/page.tsx'), 'utf8');

        expect(listSource).toContain('orderSource');
        expect(listSource).toContain("const [orderSourceFilter, setOrderSourceFilter] = useState<OrderSource | ''>('');");
        expect(listSource).toContain('orderSource: OrderSource');
        expect(listSource).toContain("params.set('orderSource', orderSourceFilter)");
        expect(listSource).toContain('Todas as origens');
        expect(listSource).toContain('<option value="ONLINE">Online</option>');
        expect(listSource).toContain('<option value="PRESENCIAL">Presencial</option>');
        expect(listSource).toContain('<option value="PRE_VENDA">Pré-venda</option>');
        expect(listSource).toContain("order.orderSource === 'PRE_VENDA'");
        expect(listSource).toContain('Pré-venda');
        expect(detailSource).toContain("order.orderSource === 'PRE_VENDA'");
        expect(detailSource).toContain('Pré-venda');
    });
});
