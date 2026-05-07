export interface InterestItem {
    quantity?: number;
    variant?: {
        size?: string | null;
        product?: {
            name?: string | null;
        } | null;
    } | null;
}

export function formatInterestItems(items: InterestItem[] = []): string[] {
    return items.map((item) => {
        const productName = item.variant?.product?.name || 'Produto não identificado';
        const size = item.variant?.size ? ` - Tam. ${item.variant.size}` : '';
        const quantity = item.quantity ?? 0;
        const unitLabel = quantity === 1 ? 'un.' : 'un.';

        return `${productName}${size} (${quantity} ${unitLabel})`;
    });
}
