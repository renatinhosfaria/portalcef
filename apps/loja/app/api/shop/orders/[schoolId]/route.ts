import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

/**
 * POST /api/shop/orders/[schoolId]
 * Proxy to backend shop order creation endpoint
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ schoolId: string }> }
) {
    try {
        const { schoolId } = await params;
        const body = await request.json();

        const url = `${API_URL}/shop/orders`;
        const payload = { ...body, schoolId };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        // Check for rate limiting
        if (response.status === 429) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "RATE_LIMIT",
                        message: "Muitos pedidos. Aguarde alguns minutos e tente novamente."
                    }
                },
                { status: 429 }
            );
        }

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Error creating order:", error);
        return NextResponse.json(
            { success: false, error: { code: "FETCH_ERROR", message: "Erro ao criar pedido" } },
            { status: 500 }
        );
    }
}
