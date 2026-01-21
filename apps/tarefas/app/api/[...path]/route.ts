import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

async function proxyRequest(request: NextRequest, method: string) {
  const path = request.nextUrl.pathname.replace(/^\/api/, "");
  const url = `${API_URL}${path}${request.nextUrl.search}`;

  const options: RequestInit = {
    method,
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
  };

  if (method !== "GET" && method !== "HEAD") {
    const contentType = request.headers.get("content-type");
    if (contentType) {
      options.headers = {
        ...options.headers,
        "content-type": contentType,
      };
    }
    options.body = await request.text();
  }

  try {
    const response = await fetch(url, options);

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "POST");
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, "PATCH");
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, "DELETE");
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, "PUT");
}
