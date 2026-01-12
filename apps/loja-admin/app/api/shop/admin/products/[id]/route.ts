import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const res = await fetch(`${API_URL}/shop/admin/products/${id}`, {
            method: "PATCH",
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
        console.error("Erro ao atualizar produto:", error);
        return NextResponse.json(
            { success: false, error: { code: "UPDATE_ERROR", message: "Erro ao atualizar produto" } },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const res = await fetch(`${API_URL}/shop/admin/products/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Cookie: request.headers.get("cookie") || "",
            },
            credentials: "include",
        });

        if (res.status === 204) {
            return new NextResponse(null, { status: 204 });
        }

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        return NextResponse.json(
            { success: false, error: { code: "DELETE_ERROR", message: "Erro ao excluir produto" } },
            { status: 500 }
        );
    }
}
