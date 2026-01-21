import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

/**
 * GET /api/shop/locations
 * Proxy to backend shop locations endpoint
 */
export async function GET(_request: NextRequest) {
  try {
    const url = `${API_URL}/api/shop/locations`;

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
    console.error("Error fetching shop locations:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "FETCH_ERROR", message: "Erro ao buscar escolas" },
      },
      { status: 500 },
    );
  }
}
