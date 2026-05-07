import { describe, expect, it } from 'vitest';

import {
    canManageCatalog,
    canManageInventory,
    canManageShopSettings,
} from '../lib/permissions';

describe('permissões do loja-admin', () => {
    it('não permite gestão de catálogo, estoque ou configurações para auxiliar_administrativo', () => {
        expect(canManageCatalog('auxiliar_administrativo')).toBe(false);
        expect(canManageInventory('auxiliar_administrativo')).toBe(false);
        expect(canManageShopSettings('auxiliar_administrativo')).toBe(false);
    });

    it('permite gestão operacional para roles administrativas de unidade/escola', () => {
        for (const role of ['master', 'diretora_geral', 'gerente_unidade']) {
            expect(canManageCatalog(role)).toBe(true);
            expect(canManageInventory(role)).toBe(true);
            expect(canManageShopSettings(role)).toBe(true);
        }
    });
});
