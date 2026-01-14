import { NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const res = await fetch(`${API_URL}/api/shop/admin/orders/presencial`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify(body),
            credentials: "include",
        });

        const data = await res.json();

        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("Erro ao criar venda presencial:", error);
        return NextResponse.json(
            { success: false, error: { code: "CREATE_ERROR", message: "Erro ao criar venda presencial" } },
            { status: 500 }
        );
    }
}
