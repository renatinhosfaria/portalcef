"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adaptDetection } from "@/features/eventos/contracts";
import { MapReview, type MapProposal } from "@/features/eventos/map-review";

export default function MapaPage() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<MapProposal[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<"EM_REVISAO" | "CONFIRMADO">("EM_REVISAO");
  const [affectedSessionIds, setAffectedSessionIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function carregarMapaAtual() {
      try {
        const eventResponse = await fetch(`/eventos-admin/api/eventos/admin/${id}`);
        if (!eventResponse.ok) throw Error();
        const eventBody = await eventResponse.json();
        const event = eventBody.data ?? eventBody;
        if (!event.defaultMapId) return;
        const revisionResponse = await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${event.defaultMapId}/revisao`);
        if (!revisionResponse.ok) throw Error();
        const revision = await revisionResponse.json();
        if (!active) return;
        setVersion(event.defaultMapId);
        setStatus(revision.map?.status === "CONFIRMADO" ? "CONFIRMADO" : "EM_REVISAO");
        setItems((revision.detections ?? []).map(adaptDetection));
      } catch {
        if (active) setError("Falha ao carregar o mapa atual.");
      }
    }
    void carregarMapaAtual();
    return () => { active = false; };
  }, [id]);

  return <section className="space-y-4"><h1>Mapa e revisão</h1>{error&&<p role="alert">{error}</p>}<MapReview proposals={items} status={status} affectedSessionIds={affectedSessionIds} onUpload={async f=>{try{const r=await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/import`,{method:"POST",body:f});if(!r.ok)throw Error();const body=await r.json();const d=body.data??body;const v=d.mapId??d.importId;setVersion(v);setStatus("EM_REVISAO");const q=await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${v}/revisao`);if(!q.ok)throw Error();const x=await q.json();setStatus(x.map?.status === "CONFIRMADO" ? "CONFIRMADO" : "EM_REVISAO");setItems((x.detections??[]).map(adaptDetection))}catch{setError("Falha ao carregar mapa.")}}} onCorrection={async p=>{try{const r=await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${version}/deteccoes`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(p)});if(!r.ok)throw Error()}catch{setError("Falha ao corrigir detecção.");throw Error("correction")}}} onConfirm={async p=>{try{const r=await fetch(`/eventos-admin/api/eventos/admin/${id}/mapas/${version}/confirmar`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(p)});if(!r.ok)throw Error();const body=await r.json();const d=body.data??body;setStatus("CONFIRMADO");try{const next=await fetch(`/eventos-admin/api/eventos/admin/${id}/mapa-padrao`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({mapId:version})});if(!next.ok)throw Error();const nextBody=await next.json();const nextData=nextBody.data??nextBody;setAffectedSessionIds(nextData.inheritedSessionIds??d.inheritedSessionIds??[])}catch{setError("Falha ao atualizar o mapa padrão; revise o inventário das sessões.");setAffectedSessionIds([])}}catch{setError("Falha ao confirmar mapa.")}}}/></section>;
}
