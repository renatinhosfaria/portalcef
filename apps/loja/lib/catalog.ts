interface CatalogVariant {
    price?: number | null;
    priceOverride?: number | null;
    availableStock?: number;
}

interface CatalogProduct {
    basePrice: number;
    variants?: CatalogVariant[];
}

export function getCatalogCardPrice(product: CatalogProduct): number {
    const availablePrices = (product.variants || [])
        .filter((variant) => (variant.availableStock ?? 0) > 0)
        .map((variant) => variant.price ?? variant.priceOverride ?? product.basePrice)
        .filter((price): price is number => typeof price === 'number');

    const priceInCents = availablePrices.length > 0
        ? Math.min(...availablePrices)
        : product.basePrice;

    return priceInCents / 100;
}
