export const INSTRUCOES_RETIRADA_PADRAO =
    'Retire seu pedido na secretaria da unidade. Apresente o código de 6 dígitos acima.';

export interface OrderItem {
    id: string;
    productName: string;
    variantSize: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    studentName: string;
    imageUrl: string;
}

interface ApiOrderItem {
    id: string;
    quantity: number;
    unitPrice: number;
    studentName: string;
    product?: {
        name?: string;
        imageUrl?: string;
    };
    variant?: {
        size?: string;
        product?: {
            name?: string;
            imageUrl?: string;
        };
    };
}

export interface ApiOrderResponse {
    orderNumber: string;
    status: 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'RETIRADO' | 'EXPIRADO' | 'CANCELADO';
    totalAmount: number;
    createdAt: string;
    expiresAt?: string | null;
    pickupInstructions?: string | null;
    customer?: {
        name?: string | null;
        phone?: string | null;
    };
    customerName?: string | null;
    customerPhone?: string | null;
    items?: ApiOrderItem[];
}

export interface Order {
    orderNumber: string;
    status: ApiOrderResponse['status'];
    totalAmount: number;
    createdAt: string;
    expiresAt: string;
    items: OrderItem[];
    pickupInstructions: string;
    customerName: string;
    customerPhone: string;
}

export function transformOrderResponse(orderData: ApiOrderResponse): Order {
    return {
        orderNumber: orderData.orderNumber,
        status: orderData.status,
        totalAmount: orderData.totalAmount,
        createdAt: orderData.createdAt,
        expiresAt: orderData.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        customerName: orderData.customer?.name ?? orderData.customerName ?? '',
        customerPhone: orderData.customer?.phone ?? orderData.customerPhone ?? '',
        pickupInstructions: orderData.pickupInstructions || INSTRUCOES_RETIRADA_PADRAO,
        items: orderData.items?.map((item: ApiOrderItem) => ({
            id: item.id,
            productName: item.product?.name || item.variant?.product?.name || 'Produto',
            variantSize: item.variant?.size || 'Único',
            quantity: item.quantity,
            unitPrice: item.unitPrice / 100,
            subtotal: (item.unitPrice * item.quantity) / 100,
            studentName: item.studentName,
            imageUrl: item.product?.imageUrl || item.variant?.product?.imageUrl || '/placeholder-product.jpg',
        })) || [],
    };
}
