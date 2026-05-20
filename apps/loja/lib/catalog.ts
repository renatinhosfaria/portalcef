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
    const variants = product.variants || [];
    const getEffectivePrices = (sourceVariants: CatalogVariant[]) =>
        sourceVariants
            .map((variant) => variant.price ?? variant.priceOverride ?? product.basePrice)
            .filter((price): price is number => typeof price === 'number');

    const availablePrices = getEffectivePrices(
        variants.filter((variant) => (variant.availableStock ?? 0) > 0),
    );
    const fallbackPrices = getEffectivePrices(variants);

    const priceInCents = availablePrices.length > 0
        ? Math.min(...availablePrices)
        : fallbackPrices.length > 0
            ? Math.min(...fallbackPrices)
            : product.basePrice;

    return priceInCents / 100;
}
