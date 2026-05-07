export interface InventoryRowIdentity {
    variantId: string;
    unitId: string;
}

export interface InventoryUnitIdentity {
    unitId: string;
    unitName?: string | null;
}

export function getInventoryRowKey(item: InventoryRowIdentity): string {
    return `${item.variantId}:${item.unitId}`;
}

export function getInventoryUnitLabel(item: InventoryUnitIdentity): string {
    return item.unitName || `Unidade ${item.unitId}`;
}
