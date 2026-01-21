import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

/**
 * GET /api/shop/catalog/[schoolId]/[unitId]
 * Proxy to backend shop catalog endpoint
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ schoolId: string; unitId: string }> }
) {
    try {
        const { schoolId, unitId } = await params;
        const { searchParams } = new URL(request.url);

        // Build query string
        const queryString = searchParams.toString();
        const url = `${API_URL}/api/shop/catalog/${schoolId}/${unitId}${queryString ? `?${queryString}` : ''}`;

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
        console.error("Error fetching catalog:", error);
        return NextResponse.json(
            { success: false, error: { code: "FETCH_ERROR", message: "Erro ao buscar catálogo" } },
            { status: 500 }
        );
    }
}
