import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

/**
 * POST /api/shop/checkout/init
 *
 * Inicializa checkout online no Stripe.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/shop/checkout/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Erro ao inicializar checkout:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FETCH_ERROR",
          message: "Erro ao inicializar pagamento online",
        },
      },
      { status: 500 },
    );
  }
}
