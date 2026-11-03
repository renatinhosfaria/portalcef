"use client";
import React, { useEffect, useState } from "react";

export type PreviousMapArchive = { archived: boolean; code: "ARCHIVED" | "MAP_IN_USE" | "NO_PREVIOUS_MAP" | "DELETED"; sessionIds?: string[] };
export type MapMigrationResult = { migratedSessionIds: string[]; inheritedSessionIds: string[]; inventoryCreatedCount: number; deletedMap: { deleted: true; code: "DELETED" } };
type Props = {
  affectedSessionIds?: string[];
  inventoryCreatedCount?: number;
  inventorySessionIds?: string[];
  previousMapArchive?: PreviousMapArchive;
  onRetryDefaultMap?: () => Promise<void>;
  onMigrateAndDelete?: () => Promise<MapMigrationResult>;
};

/** Mostra o que a publicação do mapa fez: arquivamento do mapa anterior, inventário e sessões afetadas. */
export function ResultadoPublicacao({ affectedSessionIds = [], inventoryCreatedCount, inventorySessionIds = [], previousMapArchive, onRetryDefaultMap, onMigrateAndDelete }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MapMigrationResult | null>(null);
  useEffect(() => setMigrationResult(null), [previousMapArchive]);
  const displayedArchive = migrationResult ? { archived: true, code: "DELETED" as const, sessionIds: migrationResult.migratedSessionIds } : previousMapArchive;
  const run = async (action?: () => void | Promise<void>) => { if (submitting || !action) return; setSubmitting(true); try { await action(); } catch { /* o callback mantém o alerta de erro no painel */ } finally { setSubmitting(false); } };
  return <div className="space-y-3">
    {displayedArchive?.code === "ARCHIVED" && <p className="text-emerald-700" role="status">Versão anterior arquivada com sucesso.</p>}
    {displayedArchive?.code === "DELETED" && <p className="text-emerald-700" role="status">Mapa anterior excluído após migrar {displayedArchive.sessionIds?.length ?? 0} sessão(ões) e {migrationResult?.inventoryCreatedCount ?? inventoryCreatedCount ?? 0} assento(s).</p>}
    {displayedArchive?.code === "MAP_IN_USE" && <p className="text-amber-700" role="status">O mapa anterior foi preservado porque está em uso{displayedArchive.sessionIds?.length ? ` nas sessões: ${displayedArchive.sessionIds.join(", ")}.` : "."}</p>}
    {inventoryCreatedCount !== undefined && <p className="text-emerald-700" role="status">{inventoryCreatedCount > 0 ? `Inventário gerado: ${inventoryCreatedCount} assento(s) em ${inventorySessionIds.length} sessão(ões).` : "Inventário já estava sincronizado."}</p>}
    {affectedSessionIds.length > 0 && <p className="text-amber-700">Revise o inventário de {affectedSessionIds.length} sessão(ões) após a troca do mapa.</p>}
    {onRetryDefaultMap && <button type="button" disabled={submitting} onClick={() => void run(onRetryDefaultMap)}>Substituir mapa padrão novamente</button>}
    {displayedArchive?.code === "MAP_IN_USE" && onMigrateAndDelete && <button type="button" disabled={submitting} onClick={() => void run(async () => {
      if (typeof window !== "undefined" && !window.confirm("Migrar o inventário das sessões afetadas e excluir o mapa anterior?")) return;
      const result = await onMigrateAndDelete();
      setMigrationResult(result);
    })}>Migrar sessões e excluir mapa anterior</button>}
  </div>;
}
