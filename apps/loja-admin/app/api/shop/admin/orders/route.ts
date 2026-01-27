import { NextResponse } from "next/server";

import { sanitizarClienteParaLog } from "../../../../../lib/log-seguro";

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

    console.log('[Orders Route] Backend response status:', res.status);
    console.log('[Orders Route] Backend data keys:', Object.keys(data || {}));
    console.log('[Orders Route] data.data length:', data?.data?.length);
    if (data?.data?.[0]) {
      console.log('[Orders Route] First order keys:', Object.keys(data.data[0]));
      console.log('[Orders Route] First order customer:', sanitizarClienteParaLog(data.data[0].customer));
    }

    // Mapear dados do customer para os campos planos que o frontend espera
    let orders = data?.data || [];
    if (Array.isArray(orders)) {
      orders = orders.map((order: {
        customer?: { name?: string; phone?: string; email?: string };
        customerName?: string;
        customerPhone?: string;
        customerEmail?: string;
        [key: string]: unknown;
      }) => ({
        ...order,
        customerName: order.customer?.name || order.customerName || '',
        customerPhone: order.customer?.phone || order.customerPhone || '',
        customerEmail: order.customer?.email || order.customerEmail || null,
      }));
    }

    return NextResponse.json({ ...data, data: orders }, { status: res.status });
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Erro ao buscar pedidos" } },
      { status: 500 }
    );
  }
}
