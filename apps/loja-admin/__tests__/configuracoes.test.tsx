/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConfiguracoesPage from '../app/configuracoes/page';
import { apiFetch } from '../lib/api';

let tenantState = {
    unitId: 'unit-1',
    role: 'auxiliar_administrativo',
};

vi.mock('@essencia/shared/providers/tenant', () => ({
    useTenant: () => tenantState,
}));

vi.mock('../lib/api', () => ({
    apiFetch: vi.fn(),
}));

describe('Configurações da loja-admin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        tenantState = {
            unitId: 'unit-1',
            role: 'auxiliar_administrativo',
        };
        vi.mocked(apiFetch).mockResolvedValue({
            json: async () => ({
                success: true,
                data: {
                    id: 'settings-1',
                    unitId: 'unit-1',
                    maxInstallments: 3,
                    isShopEnabled: true,
                    pickupInstructions: 'Retirada na secretaria.',
                    createdAt: '2026-04-27T10:00:00.000Z',
                    updatedAt: '2026-04-27T10:00:00.000Z',
                },
            }),
        } as Response);
    });

    it('mantém configurações somente leitura para auxiliar_administrativo', async () => {
        render(<ConfiguracoesPage />);

        await waitFor(() => {
            expect(screen.getByText('Configurações')).toBeTruthy();
        });

        expect(screen.queryByText('Salvar Alterações')).toBeNull();
        const installmentSelect = screen.getByRole('combobox') as HTMLSelectElement;
        const instructionsField = screen.getByDisplayValue('Retirada na secretaria.') as HTMLTextAreaElement;

        expect(installmentSelect.value).toBe('3');
        expect(installmentSelect.disabled).toBe(true);
        expect(instructionsField.disabled).toBe(true);
    });

    it('não fica carregando indefinidamente quando usuário não tem unidade operacional', async () => {
        tenantState = {
            unitId: '',
            role: 'diretora_geral',
        };

        render(<ConfiguracoesPage />);

        await waitFor(() => {
            expect(screen.getByText('Selecione uma unidade para gerenciar as configurações da loja.')).toBeTruthy();
        });

        expect(apiFetch).not.toHaveBeenCalled();
    });
});
