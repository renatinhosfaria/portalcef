/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EstoquePage from '../app/estoque/page';
import { apiFetch } from '../lib/api';

const searchParams = new URLSearchParams('lowStock=true');

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParams,
}));

vi.mock('@essencia/shared/providers/tenant', () => ({
    useTenant: () => ({ role: 'auxiliar_administrativo' }),
}));

vi.mock('../lib/api', () => ({
    apiFetch: vi.fn(),
}));

describe('página de estoque', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiFetch).mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [
                    {
                        variantId: 'v-low',
                        unitId: 'u-1',
                        productName: 'Camiseta',
                        variantSize: 'M',
                        reservedQuantity: 0,
                        available: 1,
                        totalSold: 4,
                        lowStockThreshold: 5,
                        needsRestock: true,
                    },
                    {
                        variantId: 'v-ok',
                        unitId: 'u-1',
                        productName: 'Calça',
                        variantSize: 'G',
                        reservedQuantity: 0,
                        available: 20,
                        totalSold: 1,
                        lowStockThreshold: 5,
                        needsRestock: false,
                    },
                ],
            }),
        } as Response);
    });

    it('filtra os itens ao abrir a tela pelo alerta de estoque baixo', async () => {
        render(<EstoquePage />);

        await waitFor(() => expect(screen.getByText('Camiseta')).toBeTruthy());

        expect(screen.queryByText('Calça')).toBeNull();
    });
});
