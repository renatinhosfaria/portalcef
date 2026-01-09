"use client";

import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@essencia/shared/schemas/calendar";
import { useCallback, useState } from "react";

import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/lib/api";

interface UseEventMutationsOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface UseEventMutationsReturn {
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  create: (data: CreateCalendarEventInput) => Promise<CalendarEvent | null>;
  update: (
    id: string,
    data: UpdateCalendarEventInput,
  ) => Promise<CalendarEvent | null>;
  remove: (id: string) => Promise<boolean>;
}

export function useEventMutations(
  options: UseEventMutationsOptions = {},
): UseEventMutationsReturn {
  const { onSuccess, onError } = options;
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const create = useCallback(
    async (data: CreateCalendarEventInput): Promise<CalendarEvent | null> => {
      try {
        setIsCreating(true);
        const event = await createCalendarEvent(data);
        onSuccess?.();
        return event;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao criar evento";
        onError?.(message);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [onSuccess, onError],
  );

  const update = useCallback(
    async (
      id: string,
      data: UpdateCalendarEventInput,
    ): Promise<CalendarEvent | null> => {
      try {
        setIsUpdating(true);
        const event = await updateCalendarEvent(id, data);
        onSuccess?.();
        return event;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao atualizar evento";
        onError?.(message);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [onSuccess, onError],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setIsDeleting(true);
        await deleteCalendarEvent(id);
        onSuccess?.();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao deletar evento";
        onError?.(message);
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [onSuccess, onError],
  );

  return {
    isCreating,
    isUpdating,
    isDeleting,
    create,
    update,
    remove,
  };
}
