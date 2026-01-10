import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

/**
 * POST /api/shop/interest/[schoolId]
 * Proxy to backend shop interest registration endpoint
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ schoolId: string }> }
) {
    try {
        const { schoolId } = await params;
        const body = await request.json();

        const url = `${API_URL}/shop/interest`;
        const payload = { ...body, schoolId };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Error registering interest:", error);
        return NextResponse.json(
            { success: false, error: { code: "FETCH_ERROR", message: "Erro ao registrar interesse" } },
            { status: 500 }
        );
    }
}
