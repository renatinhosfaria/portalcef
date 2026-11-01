"use client";
import React from "react";
import { useEffect, useState } from "react";

export type MapProposal = { id?: string; rowLabel: string; seatNumber: string; x: number; y: number; width?: number; height?: number; category?: string; confidence?: number; conflict?: string };
export type PreviousMapArchive = { archived: boolean; code: "ARCHIVED" | "MAP_IN_USE" | "NO_PREVIOUS_MAP"; sessionIds?: string[] };
type Props = { proposals: MapProposal[]; status?: "EM_REVISAO" | "CONFIRMADO"; affectedSessionIds?: string[]; inventoryCreatedCount?: number; inventorySessionIds?: string[]; previousMapArchive?: PreviousMapArchive; onRetryDefaultMap?: () => Promise<void>; onConfirm?: (p: { seats: MapProposal[]; reason?: string }) => void | Promise<void>; onCorrection?: (p: { seats: MapProposal[]; reason: string }) => Promise<void>; onUpload?: (f: FormData) => Promise<void> };

export function MapReview({ proposals, status = "EM_REVISAO", affectedSessionIds = [], inventoryCreatedCount, inventorySessionIds = [], previousMapArchive, onRetryDefaultMap, onConfirm, onCorrection, onUpload }: Props) {
  const [items, setItems] = useState(proposals);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => setItems(proposals), [proposals]);
  const current = items[selected];
  const edit = (key: keyof MapProposal, value: string) => setItems(a => a.map((x, i) => i === selected ? { ...x, [key]: key === "x" || key === "y" ? Number(value) : value } : x));
  const run = async (action?: () => void | Promise<void>) => { if (submitting || !action) return; setSubmitting(true); try { await action(); } catch { /* o callback mantém o alerta de erro no painel */ } finally { setSubmitting(false); } };
  return <div className="space-y-3 rounded border bg-white p-5">
    <p role="status">{status === "EM_REVISAO" ? "Mapa em revisão" : "Mapa confirmado"}</p>
    {previousMapArchive?.code === "ARCHIVED" && <p className="text-emerald-700" role="status">Versão anterior arquivada com sucesso.</p>}
    {previousMapArchive?.code === "MAP_IN_USE" && <p className="text-amber-700" role="status">O mapa anterior foi preservado porque está em uso{previousMapArchive.sessionIds?.length ? ` nas sessões: ${previousMapArchive.sessionIds.join(", ")}.` : "."}</p>}
    {inventoryCreatedCount !== undefined && <p className="text-emerald-700" role="status">{inventoryCreatedCount > 0 ? `Inventário gerado: ${inventoryCreatedCount} assento(s) em ${inventorySessionIds.length} sessão(ões).` : "Inventário já estava sincronizado."}</p>}
    {affectedSessionIds.length > 0 && <p className="text-amber-700">Revise o inventário de {affectedSessionIds.length} sessão(ões) após a troca do mapa.</p>}
    {onRetryDefaultMap && <button type="button" disabled={submitting} onClick={() => void run(onRetryDefaultMap)}>Substituir mapa padrão novamente</button>}
    <input type="file" accept="image/*,application/pdf" disabled={submitting} onChange={async e => { const f = e.target.files?.[0]; if (f && onUpload) { const d = new FormData(); d.append("file", f); await run(() => onUpload(d)); } }} />
    {items.map((p, i) => <button type="button" key={i} onClick={() => setSelected(i)} className={i === selected ? "font-bold" : ""}>{p.rowLabel} · {p.seatNumber}</button>)}
    {current && <div className="grid gap-2"><input value={current.rowLabel} onChange={e => edit("rowLabel", e.target.value)} /><input value={current.seatNumber} onChange={e => edit("seatNumber", e.target.value)} /><input value={current.x} onChange={e => edit("x", e.target.value)} /><input value={current.y} onChange={e => edit("y", e.target.value)} /><input value={current.category ?? ""} onChange={e => edit("category", e.target.value)} />{current.conflict && <p className="text-red-700">{current.conflict}</p>}{current.confidence !== undefined && <p>Confiança: {Math.round(current.confidence)}%</p>}</div>}
    <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo da correção" disabled={submitting} />
    <button type="button" disabled={submitting || !current || !reason.trim()} onClick={() => void run(onCorrection && current ? () => onCorrection({ seats: [current], reason }) : undefined)}>Corrigir proposta</button>
    {status === "EM_REVISAO" && <button type="button" disabled={submitting || !items.length || items.some(x => x.conflict)} onClick={() => void run(onConfirm ? () => onConfirm({ seats: items, reason: reason || undefined }) : undefined)}>Confirmar mapa</button>}
  </div>;
}
