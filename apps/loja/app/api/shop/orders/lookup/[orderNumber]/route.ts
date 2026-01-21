import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

/**
 * GET /api/shop/orders/lookup/[orderNumber]
 * Proxy to backend shop order lookup endpoint (public, requires phone)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orderNumber: string }> }
) {
    try {
        const { orderNumber } = await params;
        const { searchParams } = new URL(request.url);
        const phone = searchParams.get("phone");

        if (!phone) {
            return NextResponse.json(
                { success: false, error: { code: "MISSING_PHONE", message: "Telefone é obrigatório" } },
                { status: 400 }
            );
        }

        const url = `${API_URL}/api/shop/orders/${orderNumber}?phone=${encodeURIComponent(phone)}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            cache: "no-store",
        });

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Error fetching order:", error);
        return NextResponse.json(
            { success: false, error: { code: "FETCH_ERROR", message: "Erro ao buscar pedido" } },
            { status: 500 }
        );
    }
}
