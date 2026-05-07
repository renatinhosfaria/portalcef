import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { INSTRUCOES_RETIRADA_PADRAO, transformOrderResponse } from '../lib/order';

describe('pedido público', () => {
    it('preserva instruções de retirada retornadas pela API', () => {
        const order = transformOrderResponse({
            orderNumber: '123456',
            status: 'PAGO',
            totalAmount: 4500,
            createdAt: '2026-04-28T12:00:00.000Z',
            expiresAt: '2026-05-05T12:00:00.000Z',
            pickupInstructions: 'Retirada na coordenação da unidade.',
            customer: {
                name: 'Maria Silva',
                phone: '11987654321',
            },
            items: [],
        });

        expect(order.pickupInstructions).toBe('Retirada na coordenação da unidade.');
    });

    it('mantém instrução padrão apenas quando a API não envia configuração', () => {
        const order = transformOrderResponse({
            orderNumber: '123456',
            status: 'PAGO',
            totalAmount: 4500,
            createdAt: '2026-04-28T12:00:00.000Z',
            customerName: 'Maria Silva',
            customerPhone: '11987654321',
            items: [],
        });

        expect(order.pickupInstructions).toBe(INSTRUCOES_RETIRADA_PADRAO);
    });

    it('renderiza instruções do pedido no PDF do voucher', () => {
        const source = readFileSync(
            join(process.cwd(), 'app/pedido/[orderNumber]/VoucherPDF.tsx'),
            'utf8',
        );

        expect(source).toContain('order.pickupInstructions');
        expect(source).not.toContain('Retire seu pedido na secretaria da unidade, de segunda a sexta, das 7h às 18h.');
    });
});
