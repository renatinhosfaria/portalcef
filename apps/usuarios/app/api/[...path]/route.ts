import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const pathValue = path.join("/");
  const url = `${API_URL}/${pathValue}${request.nextUrl.search}`; // Append query params

  const headers = new Headers(request.headers);
  headers.set("host", new URL(API_URL).host);

  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: request.body,
      cache: "no-store",
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export {
  proxy as DELETE,
  proxy as GET,
  proxy as PATCH,
  proxy as POST,
  proxy as PUT,
};
