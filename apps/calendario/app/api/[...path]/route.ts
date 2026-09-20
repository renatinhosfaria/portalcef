import type { NextRequest } from "next/server";

import { proxyRequest } from "@essencia/lib/server/api-proxy";

export function GET(request: NextRequest) {
  return proxyRequest(request, "GET");
}

export function POST(request: NextRequest) {
  return proxyRequest(request, "POST");
}

export function PUT(request: NextRequest) {
  return proxyRequest(request, "PUT");
}

export function PATCH(request: NextRequest) {
  return proxyRequest(request, "PATCH");
}

export function DELETE(request: NextRequest) {
  return proxyRequest(request, "DELETE");
}

