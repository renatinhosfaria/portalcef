import { proxyRequest } from "@essencia/lib/server/api-proxy";
import type { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  return proxyRequest(request, "GET", { preservarPrefixoApi: true });
}

export function POST(request: NextRequest) {
  return proxyRequest(request, "POST", { preservarPrefixoApi: true });
}

export function PUT(request: NextRequest) {
  return proxyRequest(request, "PUT", { preservarPrefixoApi: true });
}

export function PATCH(request: NextRequest) {
  return proxyRequest(request, "PATCH", { preservarPrefixoApi: true });
}

export function DELETE(request: NextRequest) {
  return proxyRequest(request, "DELETE", { preservarPrefixoApi: true });
}
