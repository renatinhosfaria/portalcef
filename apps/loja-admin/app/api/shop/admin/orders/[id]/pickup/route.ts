import { NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const targetUrl = `${API_URL}/api/shop/admin/orders/${id}/pickup`;

        console.log(`[Pickup Route] Proxying PATCH to: ${targetUrl}`);

        const res = await fetch(targetUrl, {
            method: "PATCH",
            headers: {
                Cookie: request.headers.get("cookie") || "",
            },
            credentials: "include",
        });

        console.log(`[Pickup Route] Backend response status: ${res.status}`);

        // Tentar obter a resposta como texto primeiro
        const responseText = await res.text();
        console.log(`[Pickup Route] Backend response body: ${responseText.substring(0, 500)}`);

        // Tentar fazer parse como JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            // Se não for JSON válido, retornar erro com detalhes
            console.error(`[Pickup Route] Erro ao parsear JSON. Status: ${res.status}, Body: ${responseText.substring(0, 200)}`);
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "PARSE_ERROR",
                        message: `Erro ao processar resposta do servidor (status: ${res.status})`
                    }
                },
                { status: res.status >= 400 ? res.status : 500 }
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("[Pickup Route] Erro ao marcar retirada:", error);
        return NextResponse.json(
            { success: false, error: { code: "UPDATE_ERROR", message: "Erro ao marcar retirada" } },
            { status: 500 }
        );
    }
}
