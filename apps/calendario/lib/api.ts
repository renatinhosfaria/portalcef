/**
 * Calendar API functions
 */

import { clientFetch } from "@essencia/shared/fetchers/client";
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  QueryCalendarEventsInput,
  UpdateCalendarEventInput,
} from "@essencia/shared/schemas/calendar";

/**
 * Fetch calendar events with optional filters
 */
export async function getCalendarEvents(
  params?: QueryCalendarEventsInput,
): Promise<CalendarEvent[]> {
  const searchParams = new URLSearchParams();

  if (params?.unitId) searchParams.set("unitId", params.unitId);
  if (params?.year) searchParams.set("year", String(params.year));
  if (params?.month) searchParams.set("month", String(params.month));
  if (params?.eventType) searchParams.set("eventType", params.eventType);

  const query = searchParams.toString();
  const url = `/calendar/events${query ? `?${query}` : ""}`;

  // clientFetch already extracts data.data from the response envelope
  const events = await clientFetch<CalendarEvent[]>(url);
  return events ?? [];
}

/**
 * Fetch a single calendar event by ID
 */
export async function getCalendarEvent(id: string): Promise<CalendarEvent> {
  // clientFetch already extracts data.data from the response envelope
  return clientFetch<CalendarEvent>(`/calendar/events/${id}`);
}

/**
 * Create a new calendar event
 */
export async function createCalendarEvent(
  data: CreateCalendarEventInput,
): Promise<CalendarEvent> {
  // clientFetch already extracts data.data from the response envelope
  return clientFetch<CalendarEvent>("/calendar/events", {
    method: "POST",
    body: data,
  });
}

/**
 * Update an existing calendar event
 */
export async function updateCalendarEvent(
  id: string,
  data: UpdateCalendarEventInput,
): Promise<CalendarEvent> {
  // clientFetch already extracts data.data from the response envelope
  return clientFetch<CalendarEvent>(`/calendar/events/${id}`, {
    method: "PUT",
    body: data,
  });
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(id: string): Promise<void> {
  await clientFetch<void>(`/calendar/events/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get calendar statistics
 */
export async function getCalendarStats(params?: {
  unitId?: string;
  year?: number;
}): Promise<{
  totalSchoolDays: number;
  totalEvents: number;
  byMonth: Array<{
    month: number;
    schoolDays: number;
    events: number;
  }>;
}> {
  const searchParams = new URLSearchParams();
  if (params?.unitId) searchParams.set("unitId", params.unitId);
  if (params?.year) searchParams.set("year", String(params.year));

  const query = searchParams.toString();
  const url = `/calendar/stats${query ? `?${query}` : ""}`;

  // clientFetch already extracts data.data from the response envelope
  return clientFetch<{
    totalSchoolDays: number;
    totalEvents: number;
    byMonth: Array<{ month: number; schoolDays: number; events: number }>;
  }>(url);
}
