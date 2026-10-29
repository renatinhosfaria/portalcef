"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { flattenInventory } from "@/features/eventos/contracts";
import { InventoryGrid, type InventorySeat, type InventorySession } from "@/features/eventos/inventory-grid";

type ApiSeat = { id?: string; seatId?: string; rowLabel?: string; seatNumber?: string; status?: string };
type ApiRow = { session?: { id?: string; capacity?: number }; inventory?: ApiSeat[] };

export default function InventarioPage() {
  const { id } = useParams<{ id: string }>();
  const [seats, setSeats] = useState<InventorySeat[]>([]);
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/eventos-admin/api/eventos/admin/${id}/inventario`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((rows: unknown) => {
        const data = Array.isArray(rows) ? (rows as ApiRow[]) : [];
        setSeats(flattenInventory(data));
        setSessions(data.map((row, index) => ({
          id: String(row.session?.id ?? `sessao-${index + 1}`),
          capacity: Number(row.session?.capacity ?? 0),
          seats: flattenInventory([row]),
        })));
      })
      .catch(() => setError("Não foi possível carregar o inventário."))
      .finally(() => setLoading(false));
  }, [id]);

  return <section className="space-y-4"><h1 className="text-2xl font-semibold">Inventário</h1>{loading && <p>Carregando inventário…</p>}{error && <p role="alert">{error}</p>}<InventoryGrid sessionId={id} seats={seats} sessions={sessions} reviewHref={`/eventos/${id}/mapa`} /></section>;
}
