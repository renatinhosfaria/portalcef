/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RelatoriosPage from '../app/relatorios/page';
import { apiFetch } from '../lib/api';

vi.mock('../lib/api', () => ({
    apiFetch: vi.fn(),
}));

describe('relatórios da loja', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiFetch).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: [] }),
        } as Response);
    });

    it('informa quando a aba ainda não possui uma fonte real de dados', async () => {
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText('Relatórios')).toBeTruthy());

        expect(screen.getByText('Este relatório ainda não está disponível.')).toBeTruthy();
        expect(screen.queryByText('156')).toBeNull();
    });

    it('mantém o resumo real de pré-venda disponível', async () => {
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText('Relatórios')).toBeTruthy());
        fireEvent.click(screen.getByRole('button', { name: 'Pré-venda' }));

        await waitFor(() => expect(screen.getByText('Demanda de Pré-venda')).toBeTruthy());
        expect(apiFetch).toHaveBeenCalledWith('/api/shop/admin/orders/pre-venda/summary');
    });
});
