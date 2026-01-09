import { useTenant } from "@essencia/shared/providers/tenant";
import { toast } from "@essencia/ui/components/toaster";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY_PREFIX = "planning_draft_";
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

interface AutoSaveOptions<T> {
  data: T;
  enabled?: boolean;
}

export function useAutoSave<T>({ data, enabled = true }: AutoSaveOptions<T>) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { userId } = useTenant();
  // Use userId from tenant context (AC4)
  const visitorId = userId || "development_user";
  const storageKey = `${STORAGE_KEY_PREFIX}${visitorId}`;

  // Use a ref to track if data has changed since last save
  const dataRef = useRef(data);
  const hasUnsavedChanges = useRef(false);

  // Load draft function exposed to parent to decide when to call
  const loadDraft = useCallback((): { data: T; savedAt: Date } | null => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return null;

      const parsed = JSON.parse(saved);
      if (!parsed.data) return null;

      return {
        data: parsed.data as T,
        savedAt: new Date(parsed.savedAt),
      };
    } catch (error) {
      console.error("Failed to load draft:", error);
      return null;
    }
  }, [storageKey]);

  // Update ref when data changes
  useEffect(() => {
    // Basic deep comparison or just JSON stringify comparison
    if (JSON.stringify(data) !== JSON.stringify(dataRef.current)) {
      dataRef.current = data;
      hasUnsavedChanges.current = true;
    }
  }, [data]);

  const saveToStorage = useCallback(() => {
    if (!enabled || !hasUnsavedChanges.current) return;

    try {
      const payload = {
        data: dataRef.current,
        savedAt: new Date().toISOString(),
        version: 1,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setLastSaved(new Date());
      hasUnsavedChanges.current = false;
      toast.success("Rascunho salvo localmente");
    } catch (error) {
      console.error("Failed to save draft:", error);
    }
  }, [enabled, storageKey]);

  // Interval Auto-save
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => {
      saveToStorage();
    }, AUTO_SAVE_INTERVAL);

    // Also save on unmount/blur?
    // Story says "save onBlur of any field".
    // Does it imply save on component unmount? Usually yes.
    // However, saving on unmount might save incomplete data if user is navigating away.
    // We'll stick to timer and manual saveNow.

    return () => clearInterval(intervalId);
  }, [enabled, saveToStorage]);

  // Save manually
  const saveNow = useCallback(() => {
    saveToStorage();
  }, [saveToStorage]);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(storageKey);
      setLastSaved(null);
      hasUnsavedChanges.current = false;
    } catch (error) {
      console.error("Failed to clear draft:", error);
    }
  }, [storageKey]);

  return {
    saveNow,
    clearDraft,
    loadDraft,
    lastSaved,
  };
}
