import { proxyRequest } from "@essencia/lib/server/api-proxy";
import type { NextRequest } from "next/server";
const options = { preservarPrefixoApi: true };
export async function GET(request: NextRequest) { return proxyRequest(request, "GET", options); }
export async function POST(request: NextRequest) { return proxyRequest(request, "POST", options); }
export async function PUT(request: NextRequest) { return proxyRequest(request, "PUT", options); }
export async function PATCH(request: NextRequest) { return proxyRequest(request, "PATCH", options); }
export async function DELETE(request: NextRequest) { return proxyRequest(request, "DELETE", options); }
