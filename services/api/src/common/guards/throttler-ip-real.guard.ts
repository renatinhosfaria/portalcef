import { Injectable, SetMetadata } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerRequest } from "@nestjs/throttler";
import { isIP } from "node:net";

export const IP_REAL_DO_PROXY = "ipRealDoProxy";

export const UsarIpRealDoProxy = () => SetMetadata(IP_REAL_DO_PROXY, true);

function ipv4PrivadoOuLoopback(ip: string): boolean {
  const octetos = ip.split(".").map(Number);
  if (octetos.length !== 4 || octetos.some((octeto) => !Number.isInteger(octeto) || octeto < 0 || octeto > 255)) {
    return false;
  }

  return (
    octetos[0] === 10 ||
    octetos[0] === 127 ||
    (octetos[0] === 172 && octetos[1] >= 16 && octetos[1] <= 31) ||
    (octetos[0] === 192 && octetos[1] === 168)
  );
}

function ipv6EmHextetos(ip: string): number[] | undefined {
  const partes = ip.toLowerCase().split("::");
  if (partes.length > 2) return undefined;

  const converter = (parte: string): number[] | undefined => {
    if (!parte) return [];
    const itens = parte.split(":");
    const resultado: number[] = [];
    for (const item of itens) {
      if (item.includes(".")) {
        if (item !== itens[itens.length - 1] || !ipv4Valido(item)) return undefined;
        const octetos = item.split(".").map(Number);
        resultado.push((octetos[0] << 8) | octetos[1], (octetos[2] << 8) | octetos[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(item)) return undefined;
      resultado.push(Number.parseInt(item, 16));
    }
    return resultado;
  };

  const antes = converter(partes[0]);
  const depois = converter(partes[1] ?? "");
  if (!antes || !depois) return undefined;

  if (partes.length === 1) {
    return antes.length === 8 ? antes : undefined;
  }
  const zeros = 8 - antes.length - depois.length;
  if (zeros < 1) return undefined;
  return [...antes, ...Array.from({ length: zeros }, () => 0), ...depois];
}

function ipv4Valido(ip: string): boolean {
  return isIP(ip) === 4;
}

function ipv6PrivadoOuLoopback(ip: string): boolean {
  const hextetos = ipv6EmHextetos(ip);
  if (!hextetos) return false;

  if (hextetos.every((hexteto, indice) => (indice < 7 ? hexteto === 0 : hexteto === 1))) {
    return true;
  }

  if (hextetos[0] >= 0xfc00 && hextetos[0] <= 0xfdff) return true;

  const eIpv4Mapeado = hextetos.slice(0, 5).every((hexteto) => hexteto === 0) && hextetos[5] === 0xffff;
  if (!eIpv4Mapeado) return false;

  const octetos = [
    hextetos[6] >> 8,
    hextetos[6] & 0xff,
    hextetos[7] >> 8,
    hextetos[7] & 0xff,
  ];
  return ipv4PrivadoOuLoopback(octetos.join("."));
}

function ipPrivadoOuLoopback(ip: string): boolean {
  const familia = isIP(ip);
  if (familia === 4) return ipv4PrivadoOuLoopback(ip);
  if (familia === 6) return ipv6PrivadoOuLoopback(ip);
  return false;
}

export function ipRealDaRequisicao(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): string {
  const ipDaConexao = req.ip;
  if (!ipDaConexao || !ipPrivadoOuLoopback(ipDaConexao)) {
    return ipDaConexao ?? "desconhecido";
  }

  const cabecalho = req.headers?.["x-real-ip"];
  const primeiroValor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  const ipReal = primeiroValor?.trim();
  return ipReal && isIP(ipReal) > 0 ? ipReal : ipDaConexao;
}

@Injectable()
export class ThrottlerIpRealGuard extends ThrottlerGuard {
  protected handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const { context } = props;
    const usarIpReal = this.reflector.getAllAndOverride<boolean>(IP_REAL_DO_PROXY, [context.getHandler(), context.getClass()]);
    if (!usarIpReal) return super.handleRequest(props);

    return super.handleRequest({
      ...props,
      getTracker: ipRealDaRequisicao,
    });
  }
}
