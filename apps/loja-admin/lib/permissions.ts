const SHOP_MANAGEMENT_ROLES = new Set([
    'master',
    'diretora_geral',
    'gerente_unidade',
]);

export function canManageCatalog(role?: string | null): boolean {
    return !!role && SHOP_MANAGEMENT_ROLES.has(role);
}

export function canManageInventory(role?: string | null): boolean {
    return !!role && SHOP_MANAGEMENT_ROLES.has(role);
}

export function canManageShopSettings(role?: string | null): boolean {
    return !!role && SHOP_MANAGEMENT_ROLES.has(role);
}
