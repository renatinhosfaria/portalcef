"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveState = "idle" | "saving" | "saved" | "error" | "conflict";
export type EventoAutosaveOptions<T, S = unknown> = {
  eventId: string;
  value: T;
  dirty: boolean;
  serialize: (value: T) => S;
  save: (payload: S, eventId: string) => Promise<unknown>;
  debounceMs?: number;
};

function isConflict(error: unknown) {
  const candidate = error as { status?: number; code?: string } | null;
  return candidate?.status === 409 || candidate?.code === "VERSION_CONFLICT";
}

export function useEventoAutosave<T, S = unknown>({ eventId, value, dirty, serialize, save, debounceMs = 500 }: EventoAutosaveOptions<T, S>) {
  const [state, setState] = useState<AutosaveState>(dirty ? "idle" : "saved");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const sequence = useRef(0);
  const activeSequence = useRef(0);
  const latest = useRef({ eventId, value, dirty, serialize, save });
  latest.current = { eventId, value, dirty, serialize, save };

  const execute = useCallback(async (seq: number) => {
    const current = latest.current;
    if (!current.dirty || seq !== activeSequence.current) return;
    setState("saving");
    try {
      await current.save(current.serialize(current.value), current.eventId);
      if (seq !== activeSequence.current) return;
      setConflict(false);
      setState("saved");
      setLastSavedAt(new Date().toISOString());
    } catch (error) {
      if (seq !== activeSequence.current) return;
      if (isConflict(error)) {
        setConflict(true);
        setState("conflict");
      } else {
        setState("error");
      }
    }
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const seq = ++sequence.current;
    activeSequence.current = seq;
    const timer = setTimeout(() => void execute(seq), debounceMs);
    return () => clearTimeout(timer);
  }, [dirty, value, eventId, debounceMs, execute]);

  const retry = useCallback(() => {
    if (!latest.current.dirty) return;
    const seq = ++sequence.current;
    activeSequence.current = seq;
    void execute(seq);
  }, [execute]);

  return { state, lastSavedAt, conflict, retry };
}
