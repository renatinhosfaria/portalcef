import { describe, expect, it } from 'vitest';

import {
    canManageCatalog,
    canManageInventory,
    canManageShopSettings,
} from '../lib/permissions';

describe('permissões do loja-admin', () => {
    it('concede ao auxiliar_administrativo as mesmas permissões de gerente_unidade', () => {
        const permissoes = [
            canManageCatalog,
            canManageInventory,
            canManageShopSettings,
        ];

        for (const permissao of permissoes) {
            expect(permissao('auxiliar_administrativo')).toBe(permissao('gerente_unidade'));
            expect(permissao('auxiliar_administrativo')).toBe(true);
        }
    });

    it('permite gestão operacional para roles administrativas de unidade/escola', () => {
        for (const role of ['master', 'diretora_geral', 'gerente_unidade']) {
            expect(canManageCatalog(role)).toBe(true);
            expect(canManageInventory(role)).toBe(true);
            expect(canManageShopSettings(role)).toBe(true);
        }
    });
});
