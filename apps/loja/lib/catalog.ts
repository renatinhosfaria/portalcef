export interface CatalogVariant {
    price?: number | null;
    priceOverride?: number | null;
    availableStock?: number;
    inventory?: Array<{
        quantity: number;
        reservedQuantity: number;
    }>;
}

export interface CatalogProduct {
    id: string;
    name: string;
    basePrice: number;
    imageUrl?: string;
    images?: string[];
    category: string;
    variants?: CatalogVariant[];
}

export type ModoVendaCatalogo = 'PRONTA_ENTREGA' | 'PRE_VENDA';

export interface ProdutoCardCatalogo extends CatalogProduct {
    price: number;
    availableStock: number;
    modoVenda: ModoVendaCatalogo;
}

export function getCatalogCardPrice(product: Pick<CatalogProduct, 'basePrice' | 'variants'>): number {
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

export function transformarProdutosDoCatalogo(
    products: CatalogProduct[],
    modoVenda: ModoVendaCatalogo,
): ProdutoCardCatalogo[] {
    return products.map((product) => {
        const totalStock = product.variants?.reduce((sum, variant) => {
            if (typeof variant.availableStock === 'number') {
                return sum + variant.availableStock;
            }

            const inventoryStock = variant.inventory?.reduce(
                (inventorySum, inventory) =>
                    inventorySum + (inventory.quantity - inventory.reservedQuantity),
                0,
            ) || 0;

            return sum + inventoryStock;
        }, 0) || 0;

        return {
            ...product,
            imageUrl: product.imageUrl || undefined,
            images: product.images || [],
            price: getCatalogCardPrice(product),
            availableStock: totalStock,
            modoVenda,
        };
    });
}
