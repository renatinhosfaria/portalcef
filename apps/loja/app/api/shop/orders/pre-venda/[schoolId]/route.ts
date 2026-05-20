import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

/**
 * POST /api/shop/orders/pre-venda/[schoolId]
 * Proxy para criação pública de voucher de pré-venda.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const { schoolId } = await params;
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/shop/orders/pre-venda`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, schoolId }),
    });

    const data = await response.json();

    if (response.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT",
            message: "Muitos pedidos. Aguarde alguns minutos e tente novamente.",
          },
        },
        { status: 429 },
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Erro ao criar pedido de pré-venda:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FETCH_ERROR",
          message: "Erro ao criar pedido de pré-venda",
        },
      },
      { status: 500 },
    );
  }
}
