import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const res = await fetch(`${API_URL}/shop/admin/variants`, {
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
        console.error("Erro ao criar variante:", error);
        return NextResponse.json(
            { success: false, error: { code: "CREATE_ERROR", message: "Erro ao criar variante" } },
            { status: 500 }
        );
    }
}
