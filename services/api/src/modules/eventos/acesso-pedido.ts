import { createHash, randomBytes } from "node:crypto";

export function gerarTokenAcesso(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashTokenAcesso(token) };
}

export function hashTokenAcesso(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validadeAcesso(fimDaSessao: Date): Date {
  return new Date(fimDaSessao.getTime() + 30 * 24 * 60 * 60 * 1000);
}
