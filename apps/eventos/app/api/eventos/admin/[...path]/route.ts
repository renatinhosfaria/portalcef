import { proxyRequest } from "@essencia/lib/server/api-proxy";
export async function GET(request: Request) { return proxyRequest(request as never, "GET"); }
export async function POST(request: Request) { return proxyRequest(request as never, "POST"); }
export async function PUT(request: Request) { return proxyRequest(request as never, "PUT"); }
export async function PATCH(request: Request) { return proxyRequest(request as never, "PATCH"); }
export async function DELETE(request: Request) { return proxyRequest(request as never, "DELETE"); }
