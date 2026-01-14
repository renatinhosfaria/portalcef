import { NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

/**
 * PATCH /api/shop/admin/orders/:id/confirm-payment
 *
 * Confirma pagamento presencial de pedido (sistema de voucher)
 * Body: { paymentMethod: 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' }
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const res = await fetch(`${API_URL}/api/shop/admin/orders/${id}/confirm-payment`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: request.headers.get("cookie") || "",
            },
            credentials: "include",
            body: JSON.stringify(body),
        });

        const data = await res.json();

        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("Erro ao confirmar pagamento:", error);
        return NextResponse.json(
            { success: false, error: { code: "PAYMENT_ERROR", message: "Erro ao confirmar pagamento" } },
            { status: 500 }
        );
    }
}
