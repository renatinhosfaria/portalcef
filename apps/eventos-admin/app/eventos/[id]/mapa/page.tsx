"use client";
// compatibilidade de contrato: x.map?.status
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adaptDetection } from "@/features/eventos/contracts";
import { MapReview, type MapProposal, type PreviousMapArchive } from "@/features/eventos/map-review";

async function respostaApi(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.error?.message ?? "Falha na operação do mapa");
  return body.data ?? body;
}

type ReplacementData = { inheritedSessionIds?: string[]; inventorySessionIds?: string[]; inventoryCreatedCount?: number; previousMapArchive?: PreviousMapArchive };

export default function MapaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<MapProposal[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<"EM_REVISAO" | "CONFIRMADO">("EM_REVISAO");
  const [affectedSessionIds, setAffectedSessionIds] = useState<string[]>([]);
  const [inventoryCreatedCount, setInventoryCreatedCount] = useState<number | undefined>(undefined);
  const [inventorySessionIds, setInventorySessionIds] = useState<string[]>([]);
  const [previousMapArchive, setPreviousMapArchive] = useState<PreviousMapArchive | undefined>(undefined);
  const [mapaPadraoPendente, setMapaPadraoPendente] = useState(false);
  const [error, setError] = useState("");

  const aplicarResultado = (data: ReplacementData) => {
    setAffectedSessionIds(data.inheritedSessionIds ?? []);
    setInventoryCreatedCount(data.inventoryCreatedCount ?? 0);
    setInventorySessionIds(data.inventorySessionIds ?? []);
    setPreviousMapArchive(data.previousMapArchive);
  };

  const substituirMapaPadrao = async (mapId: string) => {
    const data = await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapa-padrao/substituir`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mapId }),
    }));
    aplicarResultado(data);
    setMapaPadraoPendente(false);
    setError("");
    router.refresh();
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
        setItems((revision.detections ?? []).map(adaptDetection));
        if (confirmado) {
          const data = await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapa-padrao`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mapId: event.defaultMapId }) }));
          if (!active) return;
          aplicarResultado(data);
          router.refresh();
        }
      } catch { if (active) setError("Falha ao carregar o mapa atual."); }
    })();
    return () => { active = false; };
  }, [id, router]);

  const retrySubstituicao = () => version ? substituirMapaPadrao(version) : Promise.resolve();

  return <section className="space-y-4"><h1>Mapa e revisão</h1>{error && <p role="alert">{error}</p>}<MapReview proposals={items} status={status} affectedSessionIds={affectedSessionIds} inventoryCreatedCount={inventoryCreatedCount} inventorySessionIds={inventorySessionIds} previousMapArchive={previousMapArchive} onRetryDefaultMap={mapaPadraoPendente ? retrySubstituicao : undefined} onUpload={async (file) => { try { const data = await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/import`, { method: "POST", body: file })); const nextVersion = data.mapId ?? data.importId; setVersion(nextVersion); setInventoryCreatedCount(undefined); setInventorySessionIds([]); setPreviousMapArchive(undefined); const revision = await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${nextVersion}/revisao`)); setStatus((revision as { map?: { status?: string } }).map?.status === "CONFIRMADO" ? "CONFIRMADO" : "EM_REVISAO"); setItems((revision.detections ?? []).map(adaptDetection)); } catch { setError("Falha ao carregar mapa."); } }} onCorrection={async (payload) => { if (!version) throw new Error("Mapa ausente"); try { await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${version}/deteccoes`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })); } catch { setError("Falha ao corrigir detecção."); throw new Error("correction"); } }} onConfirm={async (payload) => { if (!version) return; try { await respostaApi(await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${version}/confirmar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })); setStatus("CONFIRMADO"); try { await substituirMapaPadrao(version); } catch { setError("Falha ao atualizar o mapa padrão; falha na substituição. A versão confirmada foi preservada. Tente novamente."); setMapaPadraoPendente(true); } } catch { setError("Falha ao confirmar mapa."); } }} /></section>;
}
