import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const res = await fetch(`${API_URL}/shop/admin/products/${id}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Cookie: request.headers.get("cookie") || "",
            },
            credentials: "include",
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("Erro ao buscar produto:", error);
        return NextResponse.json(
            { success: false, error: { code: "FETCH_ERROR", message: "Erro ao buscar produto" } },
            { status: 500 }
        );
    }
}
