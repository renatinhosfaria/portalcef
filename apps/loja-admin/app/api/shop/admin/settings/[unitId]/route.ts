import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

/**
 * GET /api/shop/admin/settings/[unitId]
 * Proxy para API backend - buscar configurações da unidade
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ unitId: string }> }
) {
    try {
        const { unitId } = await params;

        if (!unitId) {
            return NextResponse.json(
                { success: false, error: { code: "VALIDATION_ERROR", message: "unitId é obrigatório" } },
                { status: 400 }
            );
        }

        const response = await fetch(`${API_URL}/api/shop/admin/settings/${unitId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Cookie: request.headers.get("cookie") || "",
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Error fetching settings:", error);
        return NextResponse.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao buscar configurações" } },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/shop/admin/settings/[unitId]
 * Proxy para API backend - atualizar configurações
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ unitId: string }> }
) {
    try {
        const { unitId } = await params;
        const body = await request.json();

        if (!unitId) {
            return NextResponse.json(
                { success: false, error: { code: "VALIDATION_ERROR", message: "unitId é obrigatório" } },
                { status: 400 }
            );
        }

        const response = await fetch(`${API_URL}/api/shop/admin/settings/${unitId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Error updating settings:", error);
        return NextResponse.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao atualizar configurações" } },
            { status: 500 }
        );
    }
}
