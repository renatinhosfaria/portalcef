"use client";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

// compatibilidade de contrato: x.map?.status
import { adaptDetection } from "../../../../features/eventos/contracts";
import { MapReview, type MapProposal, type PreviousMapArchive } from "../../../../features/eventos/map-review";

async function respostaApi(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.error?.message ?? "Falha na operação do mapa");
  return body.data ?? body;
}

type ReplacementData = { inheritedSessionIds: string[]; inventorySessionIds: string[]; inventoryCreatedCount: number; previousMapArchive: PreviousMapArchive };

function validarSubstituicao(data: unknown): ReplacementData {
  if (!data || typeof data !== "object") throw new Error("Resposta inválida da substituição");
  const value = data as Partial<ReplacementData>;
  const archive = value.previousMapArchive;
  const archiveValido = !!archive && typeof archive === "object" && typeof archive.archived === "boolean" && ["ARCHIVED", "MAP_IN_USE", "NO_PREVIOUS_MAP"].includes(archive.code) && (archive.sessionIds === undefined || Array.isArray(archive.sessionIds));
  if (!Array.isArray(value.inheritedSessionIds) || !Array.isArray(value.inventorySessionIds) || typeof value.inventoryCreatedCount !== "number" || !archiveValido) throw new Error("Resposta inválida da substituição");
  return value as ReplacementData;
}

export default function MapaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const refresh = router.refresh;
  const [items, setItems] = useState<MapProposal[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<"EM_REVISAO" | "CONFIRMADO">("EM_REVISAO");
  const [confirmedMapId, setConfirmedMapId] = useState<string | null>(null);
  const [affectedSessionIds, setAffectedSessionIds] = useState<string[]>([]);
  const [inventoryCreatedCount, setInventoryCreatedCount] = useState<number | undefined>(undefined);
  const [inventorySessionIds, setInventorySessionIds] = useState<string[]>([]);
  const [previousMapArchive, setPreviousMapArchive] = useState<PreviousMapArchive | undefined>(undefined);
  const [pendingSubstitutionMapId, setPendingSubstitutionMapId] = useState<string | null>(null);
  const [mapaPadraoPendente, setMapaPadraoPendente] = useState(false);
  const [error, setError] = useState("");
  const substitutionPromise = useRef<Promise<void> | null>(null);
  const confirmationPromise = useRef<Promise<void> | null>(null);

  const aplicarResultado = (data: ReplacementData) => {
    setAffectedSessionIds(data.inheritedSessionIds ?? []);
    setInventoryCreatedCount(data.inventoryCreatedCount ?? 0);
    setInventorySessionIds(data.inventorySessionIds ?? []);
    setPreviousMapArchive(data.previousMapArchive);
  };

  const substituirMapaPadrao = (mapId: string) => {
    if (substitutionPromise.current) return substitutionPromise.current;
    const promise = (async () => {
      const data = validarSubstituicao(await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapa-padrao/substituir`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mapId }),
      })));
      aplicarResultado(data);
      setPendingSubstitutionMapId(null);
      setMapaPadraoPendente(false);
      setError("");
      refresh();
    })();
    substitutionPromise.current = promise;
    void promise.then(() => { if (substitutionPromise.current === promise) substitutionPromise.current = null; }, () => { if (substitutionPromise.current === promise) substitutionPromise.current = null; });
    return promise;
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const event = await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}`));
        if (!event.defaultMapId) return;
        const revision = await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${event.defaultMapId}/revisao`));
        if (!active) return;
        const confirmado = (revision as { map?: { status?: string } }).map?.status === "CONFIRMADO";
        setVersion(event.defaultMapId);
        setStatus(confirmado ? "CONFIRMADO" : "EM_REVISAO");
        if (confirmado) setConfirmedMapId(event.defaultMapId);
        setItems((revision.detections ?? []).map(adaptDetection));
        if (confirmado) {
          const data = await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapa-padrao`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mapId: event.defaultMapId }) }));
          if (!active) return;
          aplicarResultado(data);
          refresh();
        }
      } catch { if (active) setError("Falha ao carregar o mapa atual."); }
    })();
    return () => { active = false; };
  }, [id, refresh]);

  const retrySubstituicao = async () => {
    if (!pendingSubstitutionMapId) return;
    try { await substituirMapaPadrao(pendingSubstitutionMapId); }
    catch { setStatus("CONFIRMADO"); setConfirmedMapId(pendingSubstitutionMapId); setError("Falha ao substituir o mapa padrão. A versão confirmada foi preservada. Tente novamente."); setMapaPadraoPendente(true); }
  };

  const carregarUpload = async (file: FormData) => {
    setPendingSubstitutionMapId(null);
    setMapaPadraoPendente(false);
    setError("");
    setAffectedSessionIds([]);
    setInventoryCreatedCount(undefined);
    setInventorySessionIds([]);
    setPreviousMapArchive(undefined);
    setConfirmedMapId(null);
    try {
      const data = await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/import`, { method: "POST", body: file }));
      const nextVersion = data.mapId ?? data.importId;
      setVersion(nextVersion);
      const revision = await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${nextVersion}/revisao`));
      const confirmado = (revision as { map?: { status?: string } }).map?.status === "CONFIRMADO";
      setStatus(confirmado ? "CONFIRMADO" : "EM_REVISAO");
      setConfirmedMapId(confirmado ? nextVersion : null);
      setItems((revision.detections ?? []).map(adaptDetection));
    } catch { setError("Falha ao carregar mapa."); }
  };

  const confirmarMapa = (payload: { seats: MapProposal[]; reason?: string }) => {
    if (confirmationPromise.current) return confirmationPromise.current;
    if (!version) return Promise.resolve();
    const confirmedId = version;
    const promise = (async () => {
      try {
        await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${confirmedId}/confirmar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }));
        setStatus("CONFIRMADO");
        setConfirmedMapId(confirmedId);
        try { await substituirMapaPadrao(confirmedId); }
        catch { setPendingSubstitutionMapId(confirmedId); setMapaPadraoPendente(true); setError("Falha ao atualizar o mapa padrão; falha na substituição. A versão confirmada foi preservada. Tente novamente."); }
      } catch { setError("Falha ao confirmar mapa."); }
    })();
    confirmationPromise.current = promise;
    void promise.then(() => { if (confirmationPromise.current === promise) confirmationPromise.current = null; }, () => { if (confirmationPromise.current === promise) confirmationPromise.current = null; });
    return promise;
  };

  return <section className="space-y-4"><h1>Mapa e revisão</h1>{error && <p role="alert">{error}</p>}<MapReview proposals={items} status={confirmedMapId ? "CONFIRMADO" : status} affectedSessionIds={affectedSessionIds} inventoryCreatedCount={inventoryCreatedCount} inventorySessionIds={inventorySessionIds} previousMapArchive={previousMapArchive} onRetryDefaultMap={mapaPadraoPendente ? retrySubstituicao : undefined} onUpload={carregarUpload} onCorrection={async (payload) => { if (!version) throw new Error("Mapa ausente"); try { await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${version}/deteccoes`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })); } catch { setError("Falha ao corrigir detecção."); throw new Error("correction"); } }} onConfirm={confirmarMapa} /></section>;
}
