import { NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryString = url.search;

    const res = await fetch(`${API_URL}/api/shop/admin/orders${queryString}`, {
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
    console.error("Erro ao buscar pedidos:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Erro ao buscar pedidos" } },
      { status: 500 }
    );
  }
}
