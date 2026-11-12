import { InternalServerErrorException } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";

export function gerarTokenIngresso(orderNumber: string, itemId: string): { signedToken: string; qrPayload: string } {
  const nonce = randomBytes(18).toString("base64url");
  const payload = `${orderNumber}:${itemId}:${nonce}`;
  const secret = process.env.EVENTOS_QR_SECRET;
  if (!secret) throw new InternalServerErrorException({ code: "EVENTOS_QR_SECRET_MISSING", message: "Configuração de ingressos indisponível" });
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return { signedToken: `${payload}.${signature}`, qrPayload: `evento:${payload}.${signature}` };
}
