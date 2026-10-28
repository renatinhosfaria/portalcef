import { BadRequestException } from "@nestjs/common";

/** Remove elementos e atributos ativos antes que um SVG seja exibido. */
export function sanitizeSvg(input: Buffer | string): Buffer {
  const source = Buffer.isBuffer(input) ? input.toString("utf8") : input;
  if (!/<svg(?:[\s/>])/i.test(source)) throw new BadRequestException({ code: "INVALID_MAP_SVG", message: "SVG inválido" });
  if (/<\s*(script|iframe|object|embed|foreignObject|use)\b/i.test(source) || /\bon[a-z]+\s*=/i.test(source) || /(?:javascript|data:text\/html)\s*:/i.test(source)) {
    throw new BadRequestException({ code: "UNSAFE_MAP_SVG", message: "SVG contém conteúdo ativo" });
  }
  const cleaned = source.replace(/<!DOCTYPE[^>]*>/gi, "").replace(/<\?xml[^>]*>/gi, "").replace(/\s+(?:href|xlink:href)\s*=\s*(["'])[^"']*\1/gi, "");
  return Buffer.from(cleaned, "utf8");
}
