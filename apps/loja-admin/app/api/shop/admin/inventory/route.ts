import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(request: Request) {
  try {
    const res = await fetch(`${API_URL}/shop/admin/inventory`, {
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
    console.error("Erro ao buscar inventário:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Erro ao buscar inventário" } },
      { status: 500 }
    );
  }
}
