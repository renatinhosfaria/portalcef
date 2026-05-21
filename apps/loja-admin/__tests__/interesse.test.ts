import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('página de pré-venda (/interesse)', () => {
    const source = readFileSync(join(process.cwd(), 'app/interesse/page.tsx'), 'utf8');

    it('usa sempre orderSource PRE_VENDA sem expor filtro de origem ao usuário', () => {
        expect(source).toContain("params.set('orderSource', 'PRE_VENDA')");
        expect(source).not.toContain('orderSourceFilter');
    });

    it('busca demanda pelo endpoint dedicado de summary', () => {
        expect(source).toContain("apiFetch('/api/shop/admin/orders/pre-venda/summary')");
    });

    it('calcula KPIs somando todos os campos do summary por variante', () => {
        expect(source).toContain('reservedQuantity');
        expect(source).toContain('paidQuantity');
        expect(source).toContain('pickedUpQuantity');
        expect(source).toContain('totalQuantity');
    });

    it('nunca oferece exclusão para pedidos PAGO ou RETIRADO', () => {
        expect(source).toContain("['AGUARDANDO_PAGAMENTO', 'CANCELADO', 'EXPIRADO'].includes(order.status)");
    });

    it('não permite BRINDE parcial na confirmação de pagamento', () => {
        expect(source).toContain('finalTotalPaid !== confirmPaymentModal.totalAmount');
    });

    it('exibe título Pré-venda', () => {
        expect(source).toContain('>Pré-venda<');
    });
});

describe('sidebar de navegação', () => {
    const source = readFileSync(join(process.cwd(), 'components/AdminSidebar.tsx'), 'utf8');

    it('mostra Pré-venda no menu e não mais Interesse', () => {
        expect(source).toContain("label: 'Pré-venda'");
        expect(source).not.toContain("label: 'Interesse'");
    });
});
