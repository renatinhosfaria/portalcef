"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveState = "idle" | "saving" | "saved" | "error" | "conflict";
export type EventoAutosaveOptions<T, S = unknown> = { eventId: string; value: T; dirty: boolean; serialize: (value: T) => S; save: (payload: S, eventId: string) => Promise<unknown>; debounceMs?: number; onSaved?: () => void };
export type AutosaveController<T, S> = { configure(options: Pick<EventoAutosaveOptions<T, S>, "eventId" | "serialize" | "save" | "debounceMs" | "onSaved">): void; update(value: T, dirty: boolean): void; retry(): void; invalidate(): void; snapshot(): { state: AutosaveState; lastSavedAt: string | null; conflict: boolean }; dispose(): void };

function isConflict(error: unknown) { const candidate = error as { status?: number; code?: string } | null; return candidate?.status === 409 || candidate?.code === "VERSION_CONFLICT"; }

export function createEventoAutosaveController<T, S>({ eventId, serialize, save, debounceMs = 500, onSaved, onState }: Pick<EventoAutosaveOptions<T, S>, "eventId" | "serialize" | "save" | "debounceMs" | "onSaved"> & { onState?: (snapshot: { state: AutosaveState; lastSavedAt: string | null; conflict: boolean }) => void }): AutosaveController<T, S> {
  let latestValue: T; let latestDirty = false; let currentEventId = eventId; let currentSerialize = serialize; let currentSave = save; let currentOnSaved = onSaved; let currentDebounceMs = debounceMs; let sequence = 0; let activeSequence = 0; let timer: ReturnType<typeof setTimeout> | undefined; let disposed = false;
  let current = { state: "idle" as AutosaveState, lastSavedAt: null as string | null, conflict: false };
  const publish = (patch: Partial<typeof current>) => { current = { ...current, ...patch }; onState?.(current); };
  const execute = async (seq: number) => {
    if (disposed || !latestDirty || seq !== activeSequence) return;
    publish({ state: "saving" });
    try { await currentSave(currentSerialize(latestValue), currentEventId); if (disposed || seq !== activeSequence) return; currentOnSaved?.(); publish({ state: "saved", conflict: false, lastSavedAt: new Date().toISOString() }); }
    catch (error) { if (disposed || seq !== activeSequence) return; publish(isConflict(error) ? { state: "conflict", conflict: true } : { state: "error" }); }
  };
  const schedule = () => { if (timer) clearTimeout(timer); const seq = ++sequence; activeSequence = seq; timer = setTimeout(() => void execute(seq), currentDebounceMs); };
  return {
    configure(options) { currentEventId = options.eventId; currentSerialize = options.serialize; currentSave = options.save; currentOnSaved = options.onSaved; currentDebounceMs = options.debounceMs ?? 500; },
    update(value, dirty) { latestValue = value; latestDirty = dirty; if (dirty) schedule(); else publish({ state: "saved" }); },
    retry() { if (!latestDirty) return; const seq = ++sequence; activeSequence = seq; void execute(seq); },
    invalidate() { latestDirty = false; if (timer) clearTimeout(timer); timer = undefined; activeSequence = ++sequence; publish({ state: "idle", conflict: false }); },
    snapshot: () => current,
    dispose() { disposed = true; if (timer) clearTimeout(timer); },
  };
}

export function useEventoAutosave<T, S = unknown>(options: EventoAutosaveOptions<T, S>) {
  const [, forceRender] = useState(0);
  const controller = useRef<AutosaveController<T, S> | undefined>(undefined);
  if (!controller.current) controller.current = createEventoAutosaveController({ ...options, onState: () => forceRender((value) => value + 1) });
  controller.current.configure(options);
  useEffect(() => { controller.current?.update(options.value, options.dirty); }, [options.eventId, options.debounceMs, options.value, options.dirty]);
  useEffect(() => () => controller.current?.dispose(), []);
  const retry = useCallback(() => controller.current?.retry(), []);
  const invalidate = useCallback(() => controller.current?.invalidate(), []);
  const snapshot = controller.current?.snapshot() ?? { state: options.dirty ? "idle" : "saved", lastSavedAt: null, conflict: false };
  return { ...snapshot, retry, invalidate };
}
