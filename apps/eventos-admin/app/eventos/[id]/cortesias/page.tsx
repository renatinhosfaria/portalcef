"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { CortesiaResumo } from "@essencia/shared/types";
import { cancelarCortesia, listarCortesias } from "@/features/eventos/cortesias/api-cortesias";
import { baixarVoucher } from "@/features/eventos/cortesias/baixar-voucher";
import { EmitirCortesias, type SessaoCortesia } from "@/features/eventos/cortesias/emitir-cortesias";
import { ListaCortesias } from "@/features/eventos/cortesias/lista-cortesias";

function dados<T>(body: unknown): T { return body && typeof body === "object" && "data" in body ? (body as { data: T }).data : body as T; }

export default function CortesiasPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [sessoes, setSessoes] = useState<SessaoCortesia[]>([]);
  const [cortesias, setCortesias] = useState<CortesiaResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  // Muda a cada cancelamento para o mapa da emissão mostrar o lugar liberado.
  const [versaoMapa, setVersaoMapa] = useState(0);
  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [respostaSessoes, lista] = await Promise.all([fetch(`/eventos-admin/api/eventos/admin/${id}/sessoes`, { credentials: "include" }), listarCortesias(id)]);
      if (!respostaSessoes.ok) throw new Error("sessoes");
      const linhas = dados<Array<{ id?: string; startsAt?: string; mapId?: string | null; status?: string }>>(await respostaSessoes.json());
      setSessoes((linhas ?? []).filter((linha) => linha.id).map((linha) => ({ id: linha.id!, startsAt: linha.startsAt ?? "", apta: Boolean(linha.mapId) && linha.status !== "CANCELADA" })));
      setCortesias(lista);
      setCarregado(true);
    } catch { setErro("Não foi possível carregar as cortesias."); }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  return <section className="space-y-8"><div><h1 className="text-2xl font-semibold">Cortesias</h1><p className="text-sm text-slate-600">Emita ingressos gratuitos com lugar marcado e acompanhe os cancelamentos.</p></div>{erro && <p role="alert" className="text-red-700">{erro}</p>}{!carregado ? (!erro && <p>Carregando cortesias…</p>) : <><EmitirCortesias eventId={id} sessoes={sessoes} versaoMapa={versaoMapa} aoEmitir={(emitidas) => { setCortesias((atual) => [...emitidas, ...atual]); void carregar(); }} /><div className="border-t border-slate-200 pt-6"><h2 className="mb-4 text-xl font-semibold">Cortesias emitidas</h2><ListaCortesias cortesias={cortesias} sessoes={sessoes} aoBaixar={(cortesia) => baixarVoucher(id, cortesia)} aoCancelar={async (cortesia, motivo) => { await cancelarCortesia(id, cortesia.orderId, motivo); setVersaoMapa((versao) => versao + 1); await carregar(); }} /></div></>}</section>;
}
