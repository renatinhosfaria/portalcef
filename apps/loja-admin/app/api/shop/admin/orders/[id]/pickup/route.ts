import { NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const res = await fetch(`${API_URL}/api/shop/admin/orders/${id}/pickup`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: request.headers.get("cookie") || "",
            },
            credentials: "include",
        });

        const data = await res.json();

        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("Erro ao marcar retirada:", error);
        return NextResponse.json(
            { success: false, error: { code: "UPDATE_ERROR", message: "Erro ao marcar retirada" } },
            { status: 500 }
        );
    }
}
