import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

/**
 * GET /api/shop/products/[id]
 * Proxy to backend shop product detail endpoint
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = `${API_URL}/shop/products/${id}`;

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
        console.error("Error fetching product:", error);
        return NextResponse.json(
            { success: false, error: { code: "FETCH_ERROR", message: "Erro ao buscar produto" } },
            { status: 500 }
        );
    }
}
