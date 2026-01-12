import { NextResponse } from "next/server";

/**
 * POST /api/shop/checkout/init
 *
 * DESABILITADO - Sistema de Voucher Ativo
 *
 * O sistema de pagamento online via Stripe foi temporariamente desabilitado.
 * Agora o cliente gera um voucher de compra e paga presencialmente na escola.
 *
 * Este código foi mantido para futura reintegração com Stripe.
 */
export async function POST() {
    return NextResponse.json(
        {
            success: false,
            error: {
                code: "FEATURE_DISABLED",
                message: "Pagamento online temporariamente desabilitado. Use o sistema de voucher para pagamento presencial.",
            },
        },
        { status: 503 }
    );
}

/*
// Código original mantido para referência futura:

import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const url = `${API_URL}/shop/checkout/init`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Error initializing checkout:", error);
        return NextResponse.json(
            { success: false, error: { code: "FETCH_ERROR", message: "Erro ao inicializar pagamento" } },
            { status: 500 }
        );
    }
}
*/
