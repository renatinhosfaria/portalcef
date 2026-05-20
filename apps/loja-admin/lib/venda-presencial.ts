export interface VendaPresencialVariant {
    id: string;
    size: string;
    priceOverride: number | null;
    isActive?: boolean;
    availableStock?: number;
    inventory?: Array<{
        available?: number;
        quantity?: number;
        reserved?: number;
        reservedQuantity?: number;
    }>;
}

export interface VendaPresencialProduct {
    id: string;
    name: string;
    basePrice: number;
    isPreSale?: boolean;
    variants: VendaPresencialVariant[];
}

export function getProductsForPresentialSale(
    products: VendaPresencialProduct[],
): VendaPresencialProduct[] {
    return products.filter((p) => !p.isPreSale);
}

export function getVariantEffectivePrice(
    variant: VendaPresencialVariant,
    product: VendaPresencialProduct,
): number {
    return variant.priceOverride ?? product.basePrice;
}

export function getSelectableVariants(
    product: VendaPresencialProduct,
): VendaPresencialVariant[] {
    return product.variants.filter((variant) => {
        if (variant.isActive === false) return false;

        const availableStock = getVariantAvailableStock(variant);
        return availableStock === null || availableStock > 0;
    });
}

export function getVariantAvailableStock(
    variant: VendaPresencialVariant,
): number | null {
    if (typeof variant.availableStock === 'number') {
        return variant.availableStock;
    }

    if (variant.inventory?.length) {
        return variant.inventory.reduce((sum, inventory) => {
            if (typeof inventory.available === 'number') {
                return sum + inventory.available;
            }

            const quantity = inventory.quantity ?? 0;
            const reserved = inventory.reserved ?? inventory.reservedQuantity ?? 0;
            return sum + Math.max(0, quantity - reserved);
        }, 0);
    }

    return null;
}
