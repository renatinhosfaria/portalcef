import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EscolhaLugares } from "../../../../../components/escolha/escolha-lugares";
import { EventosApiError } from "../../../../../lib/eventos-api";
import { reidratarSelecaoAssentos } from "../../../../../lib/selecao-lugares";
import { listarSessoesPublicasServidor, obterEventoPublicoServidor, obterMapaSessaoServidor } from "../../../../../lib/eventos-api-servidor";

type ParametroBusca = string | string[] | undefined;
type ParametrosSessao = { assentos?: ParametroBusca; ticketTypeIds?: ParametroBusca; conflito?: ParametroBusca; ticketTypeId?: ParametroBusca };
function primeiroParametro(value: ParametroBusca): string | undefined { return Array.isArray(value) ? value[0] : value; }
function separarIds(value: ParametroBusca): string[] { const texto = primeiroParametro(value); if (!texto) return []; try { return decodeURIComponent(texto).split(",").map((item) => item.trim()).filter(Boolean); } catch { return []; } }

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string; sessionId: string }>; searchParams?: Promise<ParametrosSessao> }) {
  const { slug, sessionId } = await params;
  const query = searchParams ? await searchParams : {};
  let evento;
  let sessions;
  try { [evento, sessions] = await Promise.all([obterEventoPublicoServidor(slug), listarSessoesPublicasServidor(slug)]); } catch (error) { if (error instanceof EventosApiError && error.status === 404) notFound(); throw error; }
  const session = sessions.find((item) => item.id === sessionId);
  if (!session || session.availability !== "available" || !session.ticketTypes.length || !session.mapId) {
    return <div className="content-width py-10"><div className="mx-auto max-w-xl rounded-3xl border border-[#e6e9e1] bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#647066]">Sessão indisponível</p><h1 className="mt-3 font-display text-3xl font-semibold text-[#1f2a24]">Não há ingressos disponíveis para esta sessão</h1><p className="mt-3 text-[#647066]">Escolha outra sessão do evento para continuar.</p><Link href={`/evento/${encodeURIComponent(slug)}`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3f6f12] px-5 py-3 text-sm font-semibold text-white">Voltar ao evento</Link></div></div>;
  }
  const map = await obterMapaSessaoServidor(sessionId);
  const seatIdsFromUrl = separarIds(query.assentos);
  const ticketTypeIdsFromUrl = separarIds(query.ticketTypeIds);
  const ticketTypeIds = ticketTypeIdsFromUrl.length ? ticketTypeIdsFromUrl : separarIds(query.ticketTypeId);
  const conflitoDisponibilidade = primeiroParametro(query.conflito) === "disponibilidade";
  const rehidratacaoBase = seatIdsFromUrl.length > 0 || conflitoDisponibilidade ? reidratarSelecaoAssentos(map, seatIdsFromUrl, ticketTypeIds) : { selection: [], unavailableSeatIds: [], invalid: false };
  const rehidratacao = conflitoDisponibilidade && rehidratacaoBase.unavailableSeatIds.length > 0 ? { ...rehidratacaoBase, invalid: true } : rehidratacaoBase;
  return <EscolhaLugares evento={evento} sessao={session} map={map} initialSelection={rehidratacao.selection} unavailableSeatIds={rehidratacao.unavailableSeatIds} initialSelectionInvalid={rehidratacao.invalid} />;
}
