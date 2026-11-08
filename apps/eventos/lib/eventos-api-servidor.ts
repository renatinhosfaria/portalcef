import { headers } from "next/headers";
import {
  listarEventosPublicos,
  listarPoliticasPublicas,
  listarSessoesPublicas,
  obterEventoPublico,
  obterIngressos,
  obterMapaSessao,
  consultarPedido,
} from "./eventos-api";

export async function cabecalhosDoCliente(): Promise<Record<string, string>> {
  const ip = (await headers()).get("x-real-ip");
  return ip === null ? {} : { "x-real-ip": ip };
}

export async function listarEventosPublicosServidor() {
  return listarEventosPublicos(await cabecalhosDoCliente());
}

export async function obterEventoPublicoServidor(slug: string) {
  return obterEventoPublico(slug, await cabecalhosDoCliente());
}

export async function listarSessoesPublicasServidor(slug: string) {
  return listarSessoesPublicas(slug, await cabecalhosDoCliente());
}

export async function listarPoliticasPublicasServidor(slug: string) {
  return listarPoliticasPublicas(slug, await cabecalhosDoCliente());
}

export async function obterMapaSessaoServidor(sessionId: string) {
  return obterMapaSessao(sessionId, await cabecalhosDoCliente());
}

export async function consultarPedidoServidor(orderNumber: string) {
  return consultarPedido(orderNumber, await cabecalhosDoCliente());
}

export async function obterIngressosServidor(orderNumber: string, acesso: string) {
  return obterIngressos(orderNumber, acesso, await cabecalhosDoCliente());
}
