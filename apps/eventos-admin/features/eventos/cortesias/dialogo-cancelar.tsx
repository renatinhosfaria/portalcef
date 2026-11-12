"use client";

import React, { useState } from "react";
import type { CortesiaResumo } from "@essencia/shared/types";

interface DialogoCancelarProps { cortesia: CortesiaResumo | null; aoConfirmar(motivo: string): Promise<void>; aoFechar(): void }

export function DialogoCancelar({ cortesia, aoConfirmar, aoFechar }: DialogoCancelarProps): React.JSX.Element | null {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!cortesia) return null;
  async function confirmar(): Promise<void> {
    const aparado = motivo.trim();
    if (aparado.length < 3) { setErro("Informe um motivo com pelo menos 3 caracteres."); return; }
    setEnviando(true); setErro(null);
    try { await aoConfirmar(aparado); }
    catch (e) { setErro((e as { code?: string })?.code === "CORTESIA_JA_UTILIZADA" ? "Este ingresso já foi usado na entrada e não pode ser cancelado." : "Não foi possível cancelar a cortesia."); }
    finally { setEnviando(false); }
  }
  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h2 className="text-lg font-semibold">Cancelar cortesia?</h2><p className="mt-2 text-sm text-slate-700">Fileira {cortesia.rowLabel} · Assento {cortesia.seatNumber} · {cortesia.participantName}. O ingresso deixa de valer e o lugar volta a ficar livre.</p><label className="mt-4 block text-sm text-slate-700">Motivo<textarea aria-label="Motivo" value={motivo} onChange={(evento) => setMotivo(evento.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" rows={3} /></label>{erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded border px-4 py-2" onClick={aoFechar}>Voltar</button><button type="button" disabled={enviando} className="rounded bg-red-700 px-4 py-2 font-medium text-white disabled:opacity-50" onClick={() => void confirmar()}>Cancelar cortesia</button></div></div></div>;
}
